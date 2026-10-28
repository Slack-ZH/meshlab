"""Chat and email-login UI checks using explicitly mocked identity/provider services."""
from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
shots = root / 'test-results/previews'
shots.mkdir(parents=True, exist_ok=True)
base = os.environ.get('MESHLAB_BASE_URL', 'http://127.0.0.1:8080/')
live = False
require_verification = os.environ.get('MESHLAB_REQUIRE_EMAIL_VERIFICATION') == 'true'
def sse(text):
    return 'data: ' + json.dumps({'choices': [{'delta': {'content': text}, 'finish_reason': 'stop'}]}) + '\n\ndata: [DONE]\n\n'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,
                                headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1050}, reduced_motion='reduce')
    page.route('**/assets/firebase-auth.js', lambda r: r.fulfill(content_type='text/javascript', body=(root/'scripts/fixtures/firebase-auth.js').read_text(encoding='utf8')))
    page.route('**/api/health', lambda r: r.fulfill(json={'ready': True, 'requiresLogin': True, 'requiresEmailVerification': require_verification}))
    page.route('**/api/account', lambda r: r.fulfill(json={'usedCny': .04, 'remainingCny': 1.96, 'limitCny': 2}))
    errors, requests, answers = [], [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: requests.append(r.post_data_json) if r.url.endswith('/api/chat') else None)
    page.goto(base, wait_until='networkidle')
    page.wait_for_function('window.__gearLab?.getState().ready')
    expect(page.locator('#chat-connection')).to_contain_text('服务已连接')
    assert page.locator('#chat-access-code').count() == 0
    page.locator('#chat-input').fill('未登录不能发送')
    expect(page.locator('#chat-send')).to_be_disabled()
    page.locator('#chat-login').click()
    page.locator('#auth-mode-signup').click()
    page.locator('#auth-email').fill('test@example.com')
    page.locator('#auth-password').fill('test-password-123')
    page.locator('#auth-confirm').fill('does-not-match')
    page.locator('#auth-submit').click()
    expect(page.locator('#auth-message')).to_contain_text('不一致')
    page.locator('#auth-confirm').fill('test-password-123')
    page.locator('#auth-submit').click()
    if require_verification:
        expect(page.locator('#auth-verify')).to_be_visible()
        expect(page.locator('#chat-send')).to_be_disabled()
        page.evaluate('window.__emailVerified = true')
        page.locator('#auth-refresh').click()
    else:
        expect(page.locator('#auth-verify')).not_to_be_visible()
        assert not page.evaluate('Boolean(window.__verificationSent)'), 'Registration must not send verification mail while disabled'
    expect(page.locator('#auth-dialog')).not_to_be_visible()
    expect(page.locator('#chat-budget')).to_contain_text('0.040')
    page.evaluate("window.__gearLab.select('input')")
    expect(page.locator('#chat-context-part')).to_contain_text('输入')
    page.locator('#chat-context-part').click()
    expect(page.locator('#details-pane')).to_be_visible()
    page.locator('#details-tab').press('ArrowLeft')
    expect(page.locator('#chat-pane')).to_be_visible()
    page.locator('#chat-input').fill('用一句话说明当前选中的零件是什么，有什么作用？')
    page.locator('#chat-input').dispatch_event('keydown', {'key': 'Enter', 'isComposing': True})
    assert not requests, 'IME composition must not submit'
    page.locator('#chat-input').press('Shift+Enter')
    assert '\n' in page.locator('#chat-input').input_value()
    if not live:
        page.route('**/api/chat', lambda route: route.fulfill(content_type='text/event-stream', body=sse('输入轴传递动力。')))
    page.locator('#chat-send').click()
    expect(page.locator('#chat-notice-text')).to_contain_text('回复完成', timeout=80000)
    assert requests[-1]['messages'][-1]['selectedPartId'] == 'input'
    answers.append(page.locator('[data-role=assistant]').last.inner_text())
    page.locator('#chat-input').fill('再用一句话说明它连接到哪一级传动。')
    page.locator('#chat-input').press('Enter')
    expect(page.locator('#chat-notice-text')).to_contain_text('回复完成', timeout=80000)
    assert len(requests[-1]['messages']) == 3
    answers.append(page.locator('[data-role=assistant]').last.inner_text())
    page.screenshot(path=str(shots / 'chat-desktop.png'), full_page=True)
    page.unroute('**/api/chat')
    page.route('**/api/chat', lambda route: route.fulfill(status=502, content_type='application/json', body=json.dumps({'message': '测试：服务暂不可用'})))
    page.locator('#chat-input').fill('测试错误恢复')
    page.locator('#chat-send').click()
    expect(page.locator('#chat-retry')).to_be_visible()
    page.unroute('**/api/chat')
    page.route('**/api/chat', lambda route: route.fulfill(content_type='text/event-stream', body=sse('<img src=x onerror=alert(1)> 这是纯文本测试。')))
    page.locator('#chat-retry').click()
    expect(page.locator('#chat-notice-text')).to_contain_text('回复完成')
    assert page.locator('#chat-messages img').count() == 0
    expect(page.locator('[data-role=assistant]').last).to_contain_text('<img')
    page.unroute('**/api/chat')
    # Controlled pending fetch makes cancellation deterministic without a paid request.
    page.evaluate("""() => { window.savedFetch = window.fetch; window.fetch = (url, options) =>
      String(url).endsWith('/chat') ? new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) : window.savedFetch(url, options); }""")
    page.locator('#chat-input').fill('测试停止')
    page.locator('#chat-send').click()
    page.locator('#chat-stop').click()
    expect(page.locator('#chat-notice-text')).to_have_text('已停止回复。')
    page.locator('#chat-retry').click()
    page.locator('#chat-reset').click()
    expect(page.locator('#chat-welcome')).to_be_visible()
    assert page.locator('.chat-message').count() == 0
    assert page.locator('#chat-scroll').evaluate('el => el.scrollTop') == 0
    page.evaluate('window.fetch = window.savedFetch')
    for width in [1440, 1100, 834, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        page.locator('#chat-input').scroll_into_view_if_needed()
        expect(page.locator('#chat-input')).to_be_visible()
        if width == 390:
            for selector in ['#chat-tab', '#details-tab', '#chat-reset', '#chat-send', '#chat-context-part']:
                box = page.locator(selector).bounding_box()
                assert box['height'] >= 44, (selector, box)
            page.evaluate('scrollTo(0, 0)')
            page.screenshot(path=str(shots / 'chat-mobile.png'), full_page=True)
    page.set_viewport_size({'width': 1440, 'height': 1050})
    page.emulate_media(color_scheme='dark')
    page.screenshot(path=str(shots / 'chat-dark.png'), full_page=True)
    page.add_style_tag(content='html{font-size:200% !important}')
    for width in [1440, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 900})
        # Wait for the Three.js resize observer to update the canvas dimensions.
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), ('200% text', width, page.evaluate("({width:innerWidth, scroll:document.documentElement.scrollWidth, x:scrollX, elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right+scrollX>innerWidth).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right}))})"))
        assert page.locator('#chat-scroll').evaluate('el => el.clientHeight') >= 100
    assert not errors, errors
    result = {'live_provider_requests': 2 if live else 0, 'live_answers': answers if live else [], 'js_errors': errors,
              'checks': ['selection-context', 'multi-turn-history', 'IME-and-newline', 'tabs-keyboard', 'retry', 'HTML-as-text', 'stop', 'clear-during-stream', 'five-widths', '44px-chat-controls']}
    report_name = 'chat-verification.json' if live else 'chat-ui-verification.json'
    (root / 'test-results' / report_name).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False), flush=True)
    browser.close()

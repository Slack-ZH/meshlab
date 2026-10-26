from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];shots=root/'test-results/previews';shots.mkdir(parents=True,exist_ok=True)
base=os.environ.get('MESHLAB_BASE_URL','http://127.0.0.1:8080/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1,reduced_motion='reduce',color_scheme='light')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base,wait_until='networkidle');page.wait_for_function('window.__gearLab?.getState().ready',timeout=120000)
 assert page.evaluate('window.__gearLab.getState().partCount')==49
 page.screenshot(path=str(shots/'desktop.png'),full_page=True)
 print('Desktop rendered',flush=True)
 page.locator('#open-parts').click();assert page.locator('#part-search').evaluate('el=>el===document.activeElement')
 page.locator('#part-search').fill('输入');assert page.locator('.part-item').count()>=1
 page.locator('[data-id="input"]').click();assert page.evaluate('window.__gearLab.getState().selected')=='input'
 page.keyboard.press('Escape');assert page.locator('#parts-panel').is_hidden()
 assert page.locator('#open-parts').evaluate('el=>el===document.activeElement')
 page.locator('#open-parts').click();page.locator('#part-search').fill('');page.screenshot(path=str(shots/'directory.png'),full_page=True)
 page.locator('#close-parts').click();page.locator('#explode-all').click();page.wait_for_timeout(200)
 assert page.evaluate('window.__gearLab.getState().explodeTarget')==1
 page.screenshot(path=str(shots/'exploded.png'),full_page=True)
 page.locator('#play').click();assert page.evaluate('window.__gearLab.getState().playing && window.__gearLab.getState().explodeTarget===0')
 page.locator('#play').click();page.locator('[data-mode="assembly"]').click()
 for _ in range(7):page.locator('#step-next').click()
 assert page.locator('#step-next').is_disabled()
 for _ in range(7):page.locator('#step-prev').click()
 assert page.locator('#step-prev').is_disabled()
 page.locator('[data-mode="explore"]').click();page.locator('#housing-mode').select_option('open')
 page.locator('#clarity-toggle').click();assert page.locator('body').evaluate("e=>e.classList.contains('solid-panels')")
 assert page.locator('.control-deck').evaluate("e=>getComputedStyle(e).backdropFilter")=='none'
 page.locator('#clarity-toggle').click()
 page.locator('[data-tab="principle"]').click();page.locator('#calc-rpm').fill('800');page.locator('#calc-rpm').dispatch_event('input');assert page.locator('#calc-output').inner_text()=='50'
 page.screenshot(path=str(shots/'principle.png'),full_page=True)
 page.locator('[data-tab="engineering"]').click()
 for a in page.locator('a[href^="downloads/"]').all():assert page.request.get(base+a.get_attribute('href')).status==200
 page.locator('[data-tab="explore"]').click();page.evaluate("window.__gearLab.select('gear1')")
 layouts=[]
 for width,height,label in [(1440,1050,'desktop'),(834,1112,'tablet'),(390,844,'mobile'),(320,740,'small-mobile')]:
  page.set_viewport_size({'width':width,'height':height})
  for tab in ['principle','engineering','explore']:
   page.locator(f'[data-tab="{tab}"]').click()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{tab}: {width}'
  page.wait_for_timeout(150)
  if width==390:
   for sel in ['#open-parts','#home-view','#top-view','#front-view','#fullscreen','#play','#explode-all','#assemble-all','#clarity-toggle','.nav-button','[data-mode]','#explode']:
    for el in page.locator(sel).all():
     box=el.bounding_box();assert box['height']>=44 and box['width']>=44,(sel,box)
   page.locator('#open-parts').click();page.locator('#part-search').fill('输出');assert page.locator('[data-id="output"]').is_visible()
   page.locator('[data-id="output"]').click();assert page.locator('#parts-panel').is_hidden()
   page.evaluate("window.__gearLab.select('gear1');scrollTo(0,0)")
  page.screenshot(path=str(shots/f'{label}.png'),full_page=True)
  layouts.append({'width':width,'no_overflow':True})
  print(label,'passed',flush=True)
 page.set_viewport_size({'width':1440,'height':1050});page.emulate_media(color_scheme='dark');page.wait_for_timeout(200)
 assert page.locator('body').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(23, 24, 27)'
 page.screenshot(path=str(shots/'desktop-dark.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
 page.screenshot(path=str(shots/'mobile-dark.png'),full_page=True)
 page.emulate_media(color_scheme='light',contrast='more');assert page.locator('.control-deck').evaluate('e=>getComputedStyle(e).backdropFilter')=='none'
 page.emulate_media(contrast='no-preference')
 # Browser text enlargement: content must reflow without horizontal document overflow.
 page.add_style_tag(content='html{font-size:200% !important}')
 for tab in ['explore','principle','engineering']:
  page.locator(f'[data-tab="{tab}"]').click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'200% type: {tab}'
 assert not errors,errors
 result={'parts':49,'js_errors':errors,'layouts':layouts,'checks':['part-search-on-mobile','selection','keyboard-Escape-and-focus','explode','play-restores','seven-step-disassembly','all-downloads','calculator','44px-mobile-main-controls','system-dark-mode','solid-mode','increased-contrast','200-percent-text-no-horizontal-overflow']}
 (root/'test-results/verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
 b.close()

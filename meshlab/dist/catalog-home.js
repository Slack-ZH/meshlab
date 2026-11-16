(() => {
 const input=document.getElementById('catalog-search'),cards=[...document.querySelectorAll('.catalog-entry')];
 if(!input)return;
 input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();let count=0;for(const card of cards){const match=card.textContent.toLowerCase().includes(q);card.hidden=!match;if(match)count++;}document.getElementById('catalog-count').textContent=`显示 ${count} / ${cards.length} 个实验`;document.getElementById('catalog-empty').hidden=count>0;});
})();

export const id=()=>crypto.randomUUID();
export function money(value){
 const s=String(value??'').trim().replace(/^R\$\s*/,'');
 if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))throw Error('Use valores como 1.250,90 ou 1250,90.');
 const neg=s.startsWith('-'),[whole,decimal='']=s.replace('-','').replaceAll('.','').split(',');
 const cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents>1e12)throw Error('Valor fora do limite permitido.');
 return neg?-cents:cents;
}
export const brl=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
export const inputMoney=c=>(c/100).toFixed(2).replace('.',',');
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
export function addMonths(date,n,day=Number(date.slice(8))){if(!validDate(date)||!Number.isInteger(n))throw Error('Data inválida.');const [y,m]=date.split('-').map(Number),d=new Date(Date.UTC(y,m-1+n,1)),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;}
export function splitCents(total,n){if(!Number.isSafeInteger(total)||total<=0||!Number.isInteger(n)||n<1||n>360||total<n)throw Error('Parcelamento inválido.');const base=Math.floor(total/n),rest=total%n;return Array.from({length:n},(_,i)=>base+(i<rest?1:0));}
export function firstDue(date,closing,due){const [y,m,d]=date.split('-').map(Number);let ref=`${y}-${String(m).padStart(2,'0')}-01`;if(d>closing)ref=addMonths(ref,1,1);if(due<=closing)ref=addMonths(ref,1,1);return addMonths(ref,0,due);}
export const empty=()=>({schema:2,accounts:[],entries:[],cards:[],debts:[],goals:[],assets:[],scenarios:[],audit:[]});
export function activeEntries(s,at=today()){return s.entries.filter(e=>!e.reversed&&e.status==='posted'&&e.date<=at);}
export function balances(s,at=today()){
 const b=Object.fromEntries(s.accounts.map(a=>[a.id,a.openingDate<=at?a.opening:0]));
 for(const e of activeEntries(s,at)){
  if(['income','refund','investment_return','adjustment'].includes(e.kind))b[e.accountId]+=e.amount;
  if(['expense','debt_payment','card_payment'].includes(e.kind))b[e.accountId]-=e.amount;
  if(e.kind==='transfer'){b[e.accountId]-=e.amount;b[e.toAccountId]+=e.amount;}
 }return b;
}
export const debtBalance=(s,d,at=today())=>d.initial-activeEntries(s,at).filter(e=>e.kind==='debt_payment'&&e.debtId===d.id).reduce((n,e)=>n+e.principal,0);
export function bills(s,cardId,at=today()){
 const map=new Map();for(const e of activeEntries(s,at).filter(e=>e.cardId===cardId)){
  if(e.kind==='card_purchase'){const key=e.dueDate.slice(0,7);map.set(key,(map.get(key)||0)+e.amount);}
  if(e.kind==='card_payment')map.set(e.billMonth,(map.get(e.billMonth)||0)-e.amount);
 }return [...map].map(([month,amount])=>({month,amount})).sort((a,b)=>a.month.localeCompare(b.month));
}
export const cardBalance=(s,c,at=today())=>bills(s,c.id,at).reduce((n,b)=>n+b.amount,0);
export function summary(s,month=today().slice(0,7),at=today()){
 const b=balances(s,at),sum=predicate=>s.accounts.filter(predicate).reduce((n,a)=>n+b[a.id],0);
 const available=sum(a=>a.kind==='checking'||a.kind==='cash'),reserved=sum(a=>a.kind==='reserve'||a.purpose==='reserve'),invested=sum(a=>a.kind==='investment'&&a.purpose!=='reserve');
 const debt=s.debts.filter(d=>d.date<=at).reduce((n,d)=>n+debtBalance(s,d,at),0)+s.cards.reduce((n,c)=>n+cardBalance(s,c,at),0);
 const asset=s.assets.filter(a=>a.date<=at).reduce((n,a)=>n+a.value,0),entries=activeEntries(s,at).filter(e=>e.date.startsWith(month));
 const income=entries.filter(e=>e.kind==='income').reduce((n,e)=>n+e.amount,0);
 const expense=entries.reduce((n,e)=>n+(['expense','card_purchase'].includes(e.kind)?e.amount:e.kind==='refund'?-e.amount:e.kind==='debt_payment'?e.amount-e.principal:0),0);
 const cashOut=entries.filter(e=>['expense','card_payment','debt_payment'].includes(e.kind)).reduce((n,e)=>n+e.amount,0);
 const dailyIds=new Set(s.accounts.filter(a=>['checking','cash'].includes(a.kind)).map(a=>a.id));
 const nextIncome=s.entries.filter(e=>!e.reversed&&e.status==='scheduled'&&e.kind==='income'&&dailyIds.has(e.accountId)&&e.date>=at).sort((a,b)=>a.date.localeCompare(b.date))[0]?.date;
 const until=nextIncome||addMonths(at,1),scheduled=s.entries.filter(e=>!e.reversed&&e.status==='scheduled'&&e.date<until);
 let committed=scheduled.filter(e=>['expense','debt_payment','card_payment'].includes(e.kind)&&dailyIds.has(e.accountId)).reduce((n,e)=>n+e.amount,0);
 committed+=scheduled.filter(e=>e.kind==='transfer'&&dailyIds.has(e.accountId)&&!dailyIds.has(e.toAccountId)).reduce((n,e)=>n+e.amount,0);
 const incomingTransfers=scheduled.filter(e=>e.kind==='transfer'&&!dailyIds.has(e.accountId)&&dailyIds.has(e.toAccountId)).reduce((n,e)=>n+e.amount,0);
 for(const c of s.cards)for(const bill of bills(s,c.id,at)){const due=addMonths(bill.month+'-01',0,c.due);if(due<until){const scheduledPayments=scheduled.filter(e=>e.kind==='card_payment'&&e.cardId===c.id&&e.billMonth===bill.month).reduce((n,e)=>n+e.amount,0);committed+=Math.max(0,bill.amount-scheduledPayments);}}
 for(const d of s.debts.filter(d=>d.date<=at&&d.installment>0)){
  const due=addMonths(at.slice(0,7)+'-01',0,d.day);
  if(due>=d.date&&due<until){const settled=activeEntries(s,at).filter(e=>e.kind==='debt_payment'&&e.debtId===d.id&&e.date.startsWith(at.slice(0,7))).reduce((n,e)=>n+e.amount,0),planned=scheduled.filter(e=>e.kind==='debt_payment'&&e.debtId===d.id&&e.date.startsWith(at.slice(0,7))).reduce((n,e)=>n+e.amount,0),remaining=debtBalance(s,d,at);if(remaining>0)committed+=Math.max(0,Math.min(d.installment-settled,remaining+Math.round(remaining*d.rate/100))-planned);}
  const nextDue=addMonths(due,1,d.day);if(nextDue<until&&debtBalance(s,d,at)>0){const planned=scheduled.filter(e=>e.kind==='debt_payment'&&e.debtId===d.id&&e.date.startsWith(nextDue.slice(0,7))).reduce((n,e)=>n+e.amount,0);committed+=Math.max(0,Math.min(d.installment,debtBalance(s,d,at))-planned);}
 }
 return {balances:b,available,reserved,invested,asset,debt,networth:available+reserved+invested+asset-debt,income,expense,cashOut,result:income-expense,committed,incomingTransfers,projected:available-committed+incomingTransfers,until,nextIncome};
}
export function validate(s){
 if(s?.schema!==2||!['accounts','entries','cards','debts','goals','assets','scenarios','audit'].every(k=>Array.isArray(s[k])))throw Error('Arquivo incompatível.');
 const allowed=new Set(['schema','accounts','entries','cards','debts','goals','assets','scenarios','audit']);if(Object.keys(s).some(k=>!allowed.has(k)))throw Error('Arquivo com campos incompatíveis.');
 const ids=new Set();for(const list of [s.accounts,s.entries,s.cards,s.debts,s.goals,s.assets,s.scenarios])for(const r of list){if(typeof r.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(r.id)||ids.has(r.id))throw Error('Identificador inválido ou duplicado.');ids.add(r.id);if(r.name!=null&&(!String(r.name).trim()||String(r.name).length>120))throw Error('Nome inválido.');}
 const account=new Map(s.accounts.map(a=>[a.id,a]));for(const a of s.accounts){if(!['checking','cash','reserve','investment'].includes(a.kind)||!Number.isSafeInteger(a.opening)||Math.abs(a.opening)>1e12||!validDate(a.openingDate)||!['','reserve',undefined].includes(a.purpose)||a.purpose==='reserve'&&!['reserve','investment'].includes(a.kind))throw Error('Conta inválida.');}
 const kinds=['income','expense','refund','transfer','adjustment','debt_payment','card_payment','card_purchase','investment_return'];
 for(const e of s.entries){if(!kinds.includes(e.kind)||!['posted','scheduled'].includes(e.status)||!validDate(e.date)||!Number.isSafeInteger(e.amount)||Math.abs(e.amount)>1e12||(e.kind!=='adjustment'&&e.amount<=0)||!String(e.description||'').trim()||e.description.length>160)throw Error('Lançamento inválido.');
  if(e.kind!=='card_purchase'&&!account.has(e.accountId))throw Error('Conta não encontrada.');
  if(e.accountId&&e.date<account.get(e.accountId).openingDate)throw Error('Lançamento anterior ao saldo inicial da conta.');
  if(e.kind==='transfer'&&(!account.has(e.toAccountId)||e.toAccountId===e.accountId||e.date<account.get(e.toAccountId).openingDate))throw Error('Transferência inválida.');
  if(e.kind==='debt_payment'&&(!s.debts.some(d=>d.id===e.debtId&&e.date>=d.date)||!Number.isSafeInteger(e.principal)||e.principal<=0||e.principal>e.amount))throw Error('Pagamento de dívida inválido.');
  if(['card_purchase','card_payment'].includes(e.kind)&&!s.cards.some(c=>c.id===e.cardId))throw Error('Cartão não encontrado.');
  if(e.kind==='card_purchase'&&(!validDate(e.dueDate)||e.dueDate<e.date))throw Error('Vencimento inválido.');
  if(e.kind==='card_payment'&&!/^\d{4}-\d{2}$/.test(e.billMonth||''))throw Error('Fatura inválida.');
 }
 for(const c of s.cards){if(!Number.isSafeInteger(c.limit)||c.limit<=0||c.limit>1e12||!Number.isInteger(c.closing)||c.closing<1||c.closing>28||!Number.isInteger(c.due)||c.due<1||c.due>28)throw Error('Cartão inválido.');if(bills(s,c.id,'9999-12-31').some(b=>b.amount<0||!Number.isSafeInteger(b.amount)))throw Error('Pagamento superior à fatura ou valor inválido.');}
 for(const d of s.debts){if(!Number.isSafeInteger(d.initial)||d.initial<=0||d.initial>1e12||!validDate(d.date)||!Number.isSafeInteger(d.installment)||d.installment<0||d.installment>1e12||!Number.isInteger(d.day)||d.day<1||d.day>28||!Number.isFinite(d.rate)||d.rate<0||d.rate>100||debtBalance(s,d,'9999-12-31')<0)throw Error('Dívida ou pagamento inválido.');}
 for(const g of s.goals){const a=account.get(g.accountId);if(!Number.isSafeInteger(g.target)||g.target<=0||g.target>1e12||g.deadline&&!validDate(g.deadline)||!a||!(a.kind==='reserve'||a.kind==='investment')||s.goals.filter(x=>x.accountId===g.accountId).length>1)throw Error('Cada meta precisa de uma conta reservada exclusiva e um prazo válido.');}
 for(const a of s.assets)if(!Number.isSafeInteger(a.value)||a.value<0||!Number.isSafeInteger(a.purchase)||a.purchase<0||!validDate(a.date)||a.debtId&&!s.debts.some(d=>d.id===a.debtId))throw Error('Bem inválido.');
 if(Object.values(balances(s,'9999-12-31')).some(n=>!Number.isSafeInteger(n)||Math.abs(n)>1e13))throw Error('Saldo fora do limite.');return s;
}
export function purchase(s,{cardId,amount,n,date,description,category}){const c=s.cards.find(c=>c.id===cardId);if(!c)throw Error('Selecione um cartão.');if(amount>c.limit-cardBalance(s,c))throw Error('Compra superior ao limite disponível.');const group=id(),due=firstDue(date,c.closing,c.due);return splitCents(amount,n).map((v,i)=>({id:id(),kind:'card_purchase',cardId,amount:v,date,dueDate:addMonths(due,i,c.due),description:description+' · '+(i+1)+'/'+n,category,status:'posted',group}));}
export function demo(){const s=empty(),date=today(),first=date.slice(0,7)+'-01';s.accounts=[{id:'daily',name:'Conta do dia a dia',kind:'checking',opening:454000,openingDate:first},{id:'reserve',name:'Reserva de emergência',kind:'reserve',opening:240000,openingDate:first},{id:'invest',name:'Investimentos',kind:'investment',opening:180000,openingDate:first}];s.goals=[{id:'goal',name:'Reserva de emergência',accountId:'reserve',target:1200000}];s.debts=[{id:'debt',name:'Empréstimo pessoal',initial:320000,date:first,installment:38000,day:25,rate:1.8}];s.cards=[{id:'card',name:'Cartão principal',limit:800000,closing:5,due:12}];s.assets=[{id:'asset',name:'Moto · exemplo',type:'Moto',value:1200000,purchase:1400000,date:first,debtId:''}];s.entries=[{id:id(),kind:'income',accountId:'daily',amount:650000,date:first,description:'Salário · exemplo',category:'Trabalho',status:'posted'},{id:id(),kind:'expense',accountId:'daily',amount:150000,date:first,description:'Aluguel · exemplo',category:'Moradia',status:'posted'}];return validate(s);}

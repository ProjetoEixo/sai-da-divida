import {id,addMonths,splitCents} from './finance.mjs';
const cents=v=>{const n=Number(v||0),out=Math.round(n*100);if(!Number.isFinite(n)||!Number.isSafeInteger(out)||out<0)throw Error('A versão anterior contém um valor inválido.');return out};
export function proposeLegacy({entradas=[],gastos=[],dividas=[]},month){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mês de importação inválido.');const first=month+'-01',entries=[],debts=[];
 for(const e of entradas){const amount=cents(e.valor);if(amount>0)entries.push({id:id(),kind:'income',amount,date:addMonths(first,0,Math.max(1,Math.min(31,Number(e.dia)||1))),status:'scheduled',description:String(e.nome||'Receita importada'),category:'Trabalho',legacyKey:'entrada:'+e.id});}
 for(const g of gastos){let amount=cents(g.valor),date=g.vencimento&&String(g.vencimento).slice(0,7)===month?g.vencimento:addMonths(first,0,Number(String(g.vencimento||'').slice(8,10))||1);
  if(g.tipo==='parcelado'&&g.data_inicio&&g.num_parcelas){const n=Number(g.num_parcelas),elapsed=(Number(month.slice(0,4))-Number(g.data_inicio.slice(0,4)))*12+Number(month.slice(5))-Number(g.data_inicio.slice(5,7));if(elapsed<0||elapsed>=n)continue;amount=splitCents(amount,n)[elapsed];date=addMonths(g.data_inicio,elapsed);}
  else if(g.gasto_recorrencia==='unica'&&g.vencimento&&String(g.vencimento).slice(0,7)!==month)continue;
  if(amount>0)entries.push({id:id(),kind:'expense',amount,date,status:'scheduled',description:String(g.nome||'Despesa importada'),category:'Outros',legacyKey:'gasto:'+g.id});
 }
 for(const d of dividas.filter(d=>!d.paga)){let initial=cents(d.valor),installment=cents(d.minimo);if(d.parcelado&&d.total_parcelas&&d.parcela_atual&&d.valor_parcela){const remaining=Math.max(0,Number(d.total_parcelas)-Number(d.parcela_atual)+1);initial=Math.min(initial,cents(d.valor_parcela)*remaining);installment=cents(d.valor_parcela)}if(initial>0)debts.push({id:id(),name:String(d.nome||'Dívida importada'),initial,installment,day:25,date:first,rate:0,status:d.status||'em-dia',legacyKey:'divida:'+d.id});}
 return{entries,debts,sourceMonth:month};
}

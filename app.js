import { db } from './firebase.js';
import {
    collection, addDoc, getDocs, query, where,
    doc, updateDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// =============================================
// VARIÁVEIS GLOBAIS
// =============================================
let vendasParaBusca = [];
let todosOsProdutos = [];
let idProdVenda     = null;
let carrinhoItens   = [];

// =============================================
// 1. CADASTRO DE PRODUTOS
// =============================================
window.calcularPreco = function() {
    const custo        = parseFloat(document.getElementById('p-custo').value)        || 0;
    const frete        = parseFloat(document.getElementById('p-frete').value)        || 0;
    const deslocamento = parseFloat(document.getElementById('p-deslocamento').value) || 0;
    const margem       = parseFloat(document.getElementById('p-lucro').value)        || 0;

    const totalCusto = custo + frete + deslocamento;
    const precoBase  = totalCusto * (1 + margem / 100);
    const vPix       = precoBase;
    const vCartao    = precoBase / 0.88;
    const lucro      = precoBase - totalCusto;

    document.getElementById('res-cartao').innerText = `R$ ${vCartao.toFixed(2)}`;
    document.getElementById('res-pix').innerText    = `R$ ${vPix.toFixed(2)}`;

    const margemParaR100  = totalCusto > 0 ? (100 / totalCusto) * 100 : 0;
    const precoR100Pix    = totalCusto > 0 ? totalCusto * (1 + margemParaR100 / 100)        : 0;
    const precoR100Cartao = totalCusto > 0 ? totalCusto * (1 + margemParaR100 / 100) / 0.88 : 0;

    const msgDiv    = document.getElementById('res-lucro-msg');
    const msgPix    = document.getElementById('res-lucro-pix');
    const msgCartao = document.getElementById('res-lucro-cartao');
    const msgDica   = document.getElementById('res-lucro-dica');

    if (msgDiv && totalCusto > 0 && margem > 0) {
        msgDiv.style.display = 'block';

        msgPix.innerHTML = `
            💚 PIX/Dinheiro: 
            <span style="color:#00ff00; font-weight:bold;">
                R$ ${lucro.toFixed(2)} de lucro
            </span>`;

        msgCartao.innerHTML = `
            💳 Cartão: 
            <span style="color:#00ff00; font-weight:bold;">
                R$ ${lucro.toFixed(2)} de lucro
            </span>
            <span style="color:#666; font-size:10px;">
                (após taxa 12% da maquininha)
            </span>`;

        msgDica.innerHTML = `
            💡 Para lucrar 
            <strong style="color:#00ff00;">R$ 100,00</strong> 
            você precisa de 
            <strong style="color:var(--gold);">
                ${margemParaR100.toFixed(1)}% de margem
            </strong><br>
            cobrando 
            <strong style="color:#00ff00;">R$ ${precoR100Pix.toFixed(2)}</strong> 
            no PIX ou 
            <strong style="color:#00ff00;">R$ ${precoR100Cartao.toFixed(2)}</strong> 
            no Cartão`;

    } else if (msgDiv) {
        msgDiv.style.display = 'none';
    }

    return {
        vPix:          vPix.toFixed(2),
        vCartao:       vCartao.toFixed(2),
        custoTotal:    totalCusto.toFixed(2),
        custoUnitario: custo.toFixed(2)
    };
}

// =============================================
// 2. ESTOQUE
// =============================================
window.carregarEstoque = async function() {
    const lista    = document.getElementById('lista-estoque');
    const datalist = document.getElementById('lista-perfumes-venda');

    if (lista) lista.innerHTML = `
        <div style="text-align:center; color:#888; padding:30px;">Carregando...</div>`;

    try {
        const snap = await getDocs(collection(db, "produtos"));
        todosOsProdutos = [];
        if (datalist) datalist.innerHTML = "";

        if (snap.empty) {
            if (lista) lista.innerHTML = `
                <div style="text-align:center; color:#888; padding:30px;">
                    Nenhum produto cadastrado ainda.
                </div>`;
            return;
        }

        snap.forEach(d => {
            todosOsProdutos.push({ id: d.id, ...d.data() });
            if (datalist) {
                const opt = document.createElement('option');
                opt.value = d.data().nome;
                datalist.appendChild(opt);
            }
        });

        if (lista) renderizarEstoque(todosOsProdutos);
    } catch(e) {
        console.error("Erro ao carregar estoque:", e);
    }
}

window.filtrarEstoque = function() {
    const termo     = (document.getElementById('busca-estoque')?.value || "").toUpperCase().trim();
    const filtrados = todosOsProdutos.filter(p =>
        (p.nome || "").toUpperCase().includes(termo)
    );
    renderizarEstoque(filtrados);
}

window.renderizarEstoque = function(produtos) {
    const lista = document.getElementById('lista-estoque');
    if (!lista) return;
    lista.innerHTML = "";

    if (!produtos || produtos.length === 0) {
        lista.innerHTML = `
            <div style="text-align:center; color:#888; padding:30px;">
                Nenhum produto encontrado.
            </div>`;
        return;
    }

    produtos.forEach(p => {
        const est        = parseInt(p.estoque) || 0;
        const vPix       = parseFloat(p.vendaPix    || 0).toFixed(2);
        const vCartao    = parseFloat(p.vendaCartao || 0).toFixed(2);
        const paguei     = parseFloat(p.custoUnitario || p.custoBase || 0).toFixed(2);
        const nomeSeguro = (p.nome || "").replace(/'/g, "\\'").replace(/"/g, '\\"');

        lista.innerHTML += `
            <div class="card item-lista">
                <div style="flex:1; cursor:pointer;"
                    onclick="irParaVenda('${p.id}', '${nomeSeguro}')"
                    title="Clique para vender este perfume">
                    <strong>${p.nome}</strong>
                    <span style="font-size:10px; color:#888; margin-left:6px;">
                        👆 clique para vender
                    </span><br>
                    <small style="color:#00ff00;">PIX: R$ ${vPix}</small> |
                    <small style="color:var(--gold);">CARTÃO: R$ ${vCartao}</small><br>
                    <small style="color:#aaa;">💸 Paguei: R$ ${paguei}</small><br>
                    <small style="color:${est <= 0 ? '#ff4d4d' : '#888'};">
                        ${est <= 0 ? '❌ ESGOTADO' : est + ' UN. EM ESTOQUE'}
                    </small>
                </div>

                <!-- ✅ NOVO: botões com ✏️ adicionado -->
                <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                    <div style="display:flex;">
                        <button class="btn-qtd"
                            onclick="event.stopPropagation(); updateQtd('${p.id}', 1)">+</button>
                        <button class="btn-qtd"
                            onclick="event.stopPropagation(); updateQtd('${p.id}', -1)">-</button>
                    </div>
                    <button onclick="event.stopPropagation(); window.abrirModalEditarProduto('${p.id}')"
                        style="background:none; border:1px solid var(--gold);
                        color:var(--gold); padding:3px 8px; border-radius:4px;
                        cursor:pointer; font-size:13px; width:100%;">
                        ✏️
                    </button>
                    <button class="btn-delete"
                        onclick="event.stopPropagation(); deleteProd('${p.id}')"
                        style="font-size:10px; padding:2px 8px; width:100%;">X</button>
                </div>
            </div>`;
    });
}

window.irParaVenda = async function(idProd, nomeProduto) {
    idProdVenda = idProd;
    if (todosOsProdutos.length === 0) await window.carregarEstoque();
    abrirAba('vendas');
    await new Promise(r => setTimeout(r, 200));
    const campoPerfume = document.getElementById('v-perfume');
    if (campoPerfume) campoPerfume.value = nomeProduto;
    window.autoPreencherVenda();
}

window.updateQtd = async function(id, n) {
    const ref = doc(db, "produtos", id);
    const s   = await getDoc(ref);
    await updateDoc(ref, {
        estoque: Math.max(0, (parseInt(s.data().estoque) || 0) + n)
    });
    window.carregarEstoque();
}

// ✅ NOVO: deleteProd corrigido — funções de edição fora dele
window.deleteProd = async function(id) {
    if (confirm("Excluir produto definitivamente?")) {
        await deleteDoc(doc(db, "produtos", id));
        window.carregarEstoque();
    }
}

// ✅ NOVO: Abre modal com dados do produto preenchidos
window.abrirModalEditarProduto = function(id) {
    const prod = todosOsProdutos.find(p => p.id === id);
    if (!prod) return alert("Produto não encontrado!");

    document.getElementById('edit-prod-id').value     = id;
    document.getElementById('edit-prod-nome').value   = prod.nome         || "";
    document.getElementById('edit-prod-qtd').value    = prod.estoque      || 0;
    document.getElementById('edit-prod-custo').value  = prod.custo        || 0;
    document.getElementById('edit-prod-frete').value  = prod.frete        || 0;
    document.getElementById('edit-prod-desloc').value = prod.deslocamento || 0;
    document.getElementById('edit-prod-margem').value = prod.margem       || 40;

    window.recalcularEdicaoProduto();
    document.getElementById('modal-editar-produto').style.display = 'block';
}

// ✅ NOVO: Recalcula preços no modal em tempo real
window.recalcularEdicaoProduto = function() {
    const custo  = parseFloat(document.getElementById('edit-prod-custo').value)  || 0;
    const frete  = parseFloat(document.getElementById('edit-prod-frete').value)  || 0;
    const desloc = parseFloat(document.getElementById('edit-prod-desloc').value) || 0;
    const margem = parseFloat(document.getElementById('edit-prod-margem').value) || 0;

    const totalCusto = custo + frete + desloc;
    const precoBase  = totalCusto * (1 + margem / 100);
    const vPix       = precoBase;
    const vCartao    = precoBase / 0.88;
    const lucro      = precoBase - totalCusto;

    const setEl = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.innerText = v;
    };
    setEl('edit-res-cartao', `R$ ${vCartao.toFixed(2)}`);
    setEl('edit-res-pix',    `R$ ${vPix.toFixed(2)}`);
    setEl('edit-res-lucro',  `R$ ${lucro.toFixed(2)}`);
}

// ✅ NOVO: Salva edição no Firestore
window.salvarEdicaoProduto = async function() {
    const id     = document.getElementById('edit-prod-id').value;
    const nome   = document.getElementById('edit-prod-nome').value.toUpperCase().trim();
    const qtd    = parseInt(document.getElementById('edit-prod-qtd').value)    || 0;
    const custo  = parseFloat(document.getElementById('edit-prod-custo').value)  || 0;
    const frete  = parseFloat(document.getElementById('edit-prod-frete').value)  || 0;
    const desloc = parseFloat(document.getElementById('edit-prod-desloc').value) || 0;
    const margem = parseFloat(document.getElementById('edit-prod-margem').value) || 0;

    if (!nome) return alert("⚠️ Informe o nome do produto!");

    const totalCusto = custo + frete + desloc;
    const precoBase  = totalCusto * (1 + margem / 100);
    const vPix       = precoBase;
    const vCartao    = precoBase / 0.88;

    try {
        await updateDoc(doc(db, "produtos", id), {
            nome,
            estoque:       qtd,
            custo,
            frete,
            deslocamento:  desloc,
            margem,
            custoBase:     totalCusto.toFixed(2),
            custoUnitario: custo.toFixed(2),
            vendaPix:      vPix.toFixed(2),
            vendaCartao:   vCartao.toFixed(2)
        });
        alert("✅ Produto atualizado com sucesso!");
        window.fecharModalEditarProduto();
        window.carregarEstoque();
    } catch(e) {
        alert("❌ Erro ao salvar: " + e.message);
    }
}

// ✅ NOVO: Fecha modal
window.fecharModalEditarProduto = function() {
    document.getElementById('modal-editar-produto').style.display = 'none';
}

// =============================================
// 3. VENDAS
// =============================================
window.autoPreencherVenda = async function() {
    const campoPerfume = document.getElementById('v-perfume');
    const campoValor   = document.getElementById('v-valor-venda');
    const pagamento    = document.getElementById('v-pagamento')?.value || 'PIX';

    if (!campoPerfume || !campoValor) return;

    const nomeBuscado = campoPerfume.value.toUpperCase().trim();

    if (!nomeBuscado) {
        idProdVenda      = null;
        campoValor.value = "";
        return;
    }

    if (todosOsProdutos.length === 0) await window.carregarEstoque();

    let produto = todosOsProdutos.find(p =>
        (p.nome || "").toUpperCase().trim() === nomeBuscado
    );
    if (!produto) {
        produto = todosOsProdutos.find(p =>
            (p.nome || "").toUpperCase().includes(nomeBuscado) ||
            nomeBuscado.includes((p.nome || "").toUpperCase().trim())
        );
    }

    if (!produto) {
        idProdVenda      = null;
        campoValor.value = "";
        return;
    }

    idProdVenda      = produto.id;
    campoValor.value = pagamento === 'Cartão'
        ? parseFloat(produto.vendaCartao || 0).toFixed(2)
        : parseFloat(produto.vendaPix    || 0).toFixed(2);
}

window.toggleTaxaCartao = function(pagamento) {
    const divFiado = document.getElementById('div-fiado');
    if (divFiado) {
        divFiado.style.display = pagamento === 'Fiado' ? 'block' : 'none';
        if (pagamento === 'Fiado') window.gerarCamposDataParcelas();
    }
    window.autoPreencherVenda();
    if (carrinhoItens.length > 0) {
        const total = parseFloat(
            carrinhoItens.reduce((s, i) => s + i.valorTotal, 0).toFixed(2)
        );
        window.atualizarResumoPagamento(total);
    }
}

window.gerarCamposDataParcelas = function() {
    const qtd       = parseInt(document.getElementById('v-parcelas')?.value) || 1;
    const container = document.getElementById('campos-datas-parcelas');
    if (!container) return;
    container.innerHTML = "";

    for (let i = 1; i <= qtd; i++) {
        const data = new Date();
        data.setMonth(data.getMonth() + i);
        const dataFormatada = data.toISOString().split('T')[0];
        container.innerHTML += `
            <div style="margin-top:10px;">
                <label style="color:var(--gold); font-size:11px;
                    font-weight:bold; text-transform:uppercase;">
                    📅 Vencimento da Parcela ${i}
                </label>
                <input type="date" id="v-data-parc-${i}"
                    value="${dataFormatada}"
                    style="width:100%; padding:12px; margin-top:5px;
                    background:#1a1a1a; border:1px solid var(--gold);
                    color:white; border-radius:8px;
                    box-sizing:border-box; font-size:16px;">
            </div>`;
    }
}

// =============================================
// CARRINHO DE ITENS
// =============================================
window.adicionarItemCarrinho = function() {
    const nomePerfume = document.getElementById('v-perfume')?.value.toUpperCase().trim();
    const qtd         = parseInt(document.getElementById('v-qtd-item')?.value) || 1;
    const valorUnit   = parseFloat(document.getElementById('v-valor-venda')?.value) || 0;

    if (!nomePerfume) return alert("⚠️ Informe o nome do perfume!");
    if (!idProdVenda) return alert("⚠️ Perfume não encontrado no estoque!");
    if (valorUnit <= 0) return alert("⚠️ Valor inválido! Selecione o perfume primeiro.");
    if (qtd <= 0)       return alert("⚠️ Quantidade inválida!");

    const existente = carrinhoItens.find(i => i.idProd === idProdVenda);
    if (existente) {
        existente.qtd       += qtd;
        existente.valorTotal = parseFloat((existente.valorUnit * existente.qtd).toFixed(2));
    } else {
        carrinhoItens.push({
            idProd:     idProdVenda,
            nome:       nomePerfume,
            qtd:        qtd,
            valorUnit:  parseFloat(valorUnit.toFixed(2)),
            valorTotal: parseFloat((valorUnit * qtd).toFixed(2))
        });
    }

    document.getElementById('v-perfume').value     = "";
    document.getElementById('v-qtd-item').value    = "1";
    document.getElementById('v-valor-venda').value = "";
    idProdVenda = null;

    window.renderizarCarrinho();
}

window.removerItemCarrinho = function(index) {
    carrinhoItens.splice(index, 1);
    window.renderizarCarrinho();
}

window.renderizarCarrinho = function() {
    const lista   = document.getElementById('lista-carrinho');
    const divTot  = document.getElementById('div-total-carrinho');
    const spanTot = document.getElementById('total-carrinho-valor');

    if (!lista) return;
    lista.innerHTML = "";

    if (carrinhoItens.length === 0) {
        if (divTot) divTot.style.display = 'none';
        return;
    }

    let total = parseFloat(
        carrinhoItens.reduce((s, item) => s + item.valorTotal, 0).toFixed(2)
    );

    carrinhoItens.forEach((item, i) => {
        lista.innerHTML += `
            <div style="display:flex; justify-content:space-between;
                align-items:center; padding:10px 12px;
                background:#111; border-radius:8px;
                margin-bottom:6px;
                border-left:3px solid var(--gold);">
                <div>
                    <strong style="color:white; font-size:13px;">
                        🌸 ${item.nome}
                    </strong><br>
                    <small style="color:#aaa;">
                        ${item.qtd}x R$ ${item.valorUnit.toFixed(2)}
                    </small>
                </div>
                <div style="text-align:right;">
                    <strong style="color:var(--gold);">
                        R$ ${item.valorTotal.toFixed(2)}
                    </strong><br>
                    <button onclick="window.removerItemCarrinho(${i})"
                        style="background:none; border:none;
                        color:#ff4d4d; cursor:pointer;
                        font-size:11px; margin-top:4px;">
                        🗑️ remover
                    </button>
                </div>
            </div>`;
    });

    if (divTot)  divTot.style.display = 'block';
    if (spanTot) spanTot.innerText    = `R$ ${total.toFixed(2)}`;

    window.atualizarResumoPagamento(total);
}

window.atualizarResumoPagamento = function(total) {
    const pag = document.getElementById('v-pagamento')?.value || 'PIX';

    ['resumo-pix', 'resumo-cartao', 'resumo-fiado'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (pag === 'PIX' || pag === 'Dinheiro') {
        const el = document.getElementById('resumo-pix');
        if (el) el.style.display = 'block';
        const rp = document.getElementById('res-val-pix');
        const rl = document.getElementById('res-liq-pix');
        if (rp) rp.innerText = `R$ ${total.toFixed(2)}`;
        if (rl) rl.innerText = `R$ ${total.toFixed(2)}`;

    } else if (pag === 'Cartão') {
        const taxaPerc = 12;
        const liquido  = total / 1.12;
        const taxa     = total - liquido;
        const el = document.getElementById('resumo-cartao');
        if (el) el.style.display = 'block';
        const rv  = document.getElementById('res-val-cartao');
        const rpc = document.getElementById('res-perc-cartao');
        const rt  = document.getElementById('res-taxa-cartao');
        const rl  = document.getElementById('res-liq-cartao');
        if (rv)  rv.innerText  = `R$ ${total.toFixed(2)}`;
        if (rpc) rpc.innerText = `${taxaPerc}`;
        if (rt)  rt.innerText  = `-R$ ${taxa.toFixed(2)}`;
        if (rl)  rl.innerText  = `R$ ${liquido.toFixed(2)}`;

    } else if (pag === 'Fiado') {
        const parcelas = parseInt(document.getElementById('v-parcelas')?.value) || 1;
        const porParc  = total / parcelas;
        const el = document.getElementById('resumo-fiado');
        if (el) el.style.display = 'block';
        const rv  = document.getElementById('res-val-fiado');
        const rq  = document.getElementById('res-qtd-fiado');
        const rpp = document.getElementById('res-parc-fiado');
        if (rv)  rv.innerText  = `R$ ${total.toFixed(2)}`;
        if (rq)  rq.innerText  = `${parcelas}x`;
        if (rpp) rpp.innerText = `R$ ${porParc.toFixed(2)}`;
    }
}

// =============================================
// SALVAR VENDA
// =============================================
window.salvarVenda = async function() {
    const nomeC = document.getElementById('v-cliente').value.toUpperCase().trim();
    const pag   = document.getElementById('v-pagamento').value;

    if (!nomeC)                     return alert("⚠️ Informe o nome do cliente!");
    if (carrinhoItens.length === 0) return alert("⚠️ Adicione pelo menos um perfume ao carrinho!");

    try {
        for (const item of carrinhoItens) {
            const refProd = doc(db, "produtos", item.idProd);
            const pSnap   = await getDoc(refProd);
            if (!pSnap.exists()) return alert(`❌ Produto "${item.nome}" não encontrado!`);
            const estoque = parseInt(pSnap.data().estoque) || 0;
            if (estoque < item.qtd) {
                return alert(
                    `❌ ESTOQUE INSUFICIENTE!\n\n🌸 ${item.nome}\n` +
                    `Disponível: ${estoque} | Solicitado: ${item.qtd}`
                );
            }
        }

        const totalParcelas = pag === 'Fiado'
            ? (parseInt(document.getElementById('v-parcelas')?.value) || 1)
            : 1;

        let datasParcelas = [];
        if (pag === 'Fiado') {
            for (let i = 1; i <= totalParcelas; i++) {
                const campo = document.getElementById(`v-data-parc-${i}`);
                const data  = campo ? campo.value : "";
                if (!data) return alert(`⚠️ Informe a data da parcela ${i}!`);
                datasParcelas.push(data);
            }
        }

        const valorCliente = parseFloat(
            carrinhoItens.reduce((s, i) => s + i.valorTotal, 0).toFixed(2)
        );
        if (valorCliente <= 0) return alert("⚠️ Valor da venda inválido!");

        let taxaPerc     = 0;
        let taxaReais    = 0;
        let valorLiquido = valorCliente;
        if (pag === 'Cartão') {
            taxaPerc     = 12;
            valorLiquido = valorCliente / 1.12;
            taxaReais    = valorCliente - valorLiquido;
        }

        const contato          = document.getElementById('v-contato').value.trim();
        const endereco         = document.getElementById('v-endereco').value.trim();
        const dataVenda        = document.getElementById('v-data').value;
        const retirada         = document.getElementById('v-retirada')?.checked || false;
        const perfumePrincipal = carrinhoItens.map(i => `${i.qtd}x ${i.nome}`).join(', ');

        let custoTotalVenda  = 0;
        let freteTotalVenda  = 0;
        let deslocTotalVenda = 0;

        for (const item of carrinhoItens) {
            const refProd = doc(db, "produtos", item.idProd);
            const pSnap   = await getDoc(refProd);
            if (pSnap.exists()) {
                const pd  = pSnap.data();
                const qtd = item.qtd || 1;
                custoTotalVenda  += parseFloat(pd.custo        || pd.custoUnitario || 0) * qtd;
                freteTotalVenda  += parseFloat(pd.frete        || 0) * qtd;
                deslocTotalVenda += parseFloat(pd.deslocamento || 0) * qtd;
            }
        }

        const freteDespesa  = retirada ? 0 : freteTotalVenda;
        const deslocDespesa = deslocTotalVenda;
        const lucroEstimado = parseFloat(
            (valorLiquido - custoTotalVenda - freteDespesa - deslocDespesa).toFixed(2)
        );

        const venda = {
            data:            dataVenda,
            cliente:         nomeC,
            contato,
            endereco,
            perfume:         perfumePrincipal,
            itens:           carrinhoItens,
            valorCliente:    parseFloat(valorCliente.toFixed(2)),
            valorLiquido:    parseFloat(valorLiquido.toFixed(2)),
            valor:           parseFloat(valorLiquido.toFixed(2)),
            taxaCartaoPerc:  taxaPerc,
            taxaCartaoReais: parseFloat(taxaReais.toFixed(2)),
            pagamento:       pag,
            status:          pag === 'Fiado' ? 'Pendente' : 'Pago',
            parcelasTotais:  totalParcelas,
            parcelasPagas:   0,
            datasParcelas,
            historicoParc:   [],
            saldoRestante:   parseFloat(valorLiquido.toFixed(2)),
            retirada,
            custoTotal:      parseFloat(custoTotalVenda.toFixed(2)),
            freteTotal:      parseFloat(freteTotalVenda.toFixed(2)),
            deslocTotal:     parseFloat(deslocTotalVenda.toFixed(2)),
            lucroEstimado
        };

        let mensagemWhats = `🌸 *BW PARFUM IMPORTS*\n`;
        mensagemWhats += `━━━━━━━━━━━━━━━━━━━━\n`;
        mensagemWhats += `👤 *${nomeC}*\n`;
        mensagemWhats += `📅 Data: ${dataVenda}\n`;
        mensagemWhats += `━━━━━━━━━━━━━━━━━━━━\n`;
        mensagemWhats += `🛒 *Itens:*\n`;
        carrinhoItens.forEach(item => {
            mensagemWhats += `  • ${item.nome} × ${item.qtd} — R$ ${parseFloat(item.valorTotal).toFixed(2)}\n`;
        });
        mensagemWhats += `━━━━━━━━━━━━━━━━━━━━\n`;
        mensagemWhats += `💰 *Total: R$ ${valorCliente.toFixed(2)}*\n`;
        mensagemWhats += `💳 Pagamento: ${pag}\n`;
        if (pag === 'Cartão') {
            mensagemWhats += `📉 Taxa (12%): -R$ ${taxaReais.toFixed(2)}\n`;
            mensagemWhats += `✅ Valor líquido: R$ ${valorLiquido.toFixed(2)}\n`;
        }
        if (pag === 'Fiado') {
            mensagemWhats += `📋 ${totalParcelas}x de R$ ${(valorCliente / totalParcelas).toFixed(2)}\n`;
            datasParcelas.forEach((dt, i) => {
                mensagemWhats += `  Parcela ${i+1}: ${dt}\n`;
            });
        }
        mensagemWhats += `━━━━━━━━━━━━━━━━━━━━\n`;
        mensagemWhats += `✅ Obrigado pela preferência! 🥰`;

        const querEnviar = confirm("✅ Venda finalizada!\n\n📱 Deseja enviar comprovante pelo WhatsApp?");
        if (querEnviar && contato) {
            const tel = contato.replace(/\D/g, '');
            window.open(
                `https://wa.me/55${tel}?text=${encodeURIComponent(mensagemWhats)}`,
                '_blank'
            );
        }

        const clientesSnap = await getDocs(
            query(collection(db, "clientes"), where("nome", "==", nomeC))
        );
        if (!clientesSnap.empty) {
            const clienteDoc  = clientesSnap.docs[0];
            const dadosAtuais = clienteDoc.data();
            const contatoMudou  = contato  && contato  !== dadosAtuais.contato;
            const enderecoMudou = endereco && endereco !== dadosAtuais.endereco;
            if (contatoMudou || enderecoMudou) {
                const ok = confirm(
                    `⚠️ Cliente "${nomeC}" já existe!\n\n` +
                    `📱 Contato atual: ${dadosAtuais.contato || '---'}\n` +
                    `📍 Endereço atual: ${dadosAtuais.endereco || '---'}\n\n` +
                    `Deseja atualizar os dados?`
                );
                if (ok) {
                    await updateDoc(doc(db, "clientes", clienteDoc.id), { contato, endereco });
                }
            }
        } else {
            await addDoc(collection(db, "clientes"), { nome: nomeC, contato, endereco });
        }

        await addDoc(collection(db, "vendas"), venda);

        for (const item of carrinhoItens) {
            const refProd      = doc(db, "produtos", item.idProd);
            const pSnap        = await getDoc(refProd);
            const estoqueAtual = parseInt(pSnap.data().estoque) || 0;
            await updateDoc(refProd, { estoque: estoqueAtual - item.qtd });
        }

        carrinhoItens = [];
        setTimeout(() => location.reload(), 500);

    } catch(e) {
        alert("Erro: " + e.message);
        console.error(e);
    }
}

// =============================================
// 4. FIADOS
// =============================================
window.carregarFiados = async function() {
    const lista = document.getElementById('lista-fiados');
    lista.innerHTML = "";

    const snap = await getDocs(
        query(collection(db, "vendas"), where("status", "==", "Pendente"))
    );

    if (snap.empty) {
        lista.innerHTML = `
            <div class="card" style="text-align:center; color:#888;">
                Nenhum fiado pendente 🎉
            </div>`;
        return;
    }

    snap.forEach(d => {
        const f         = d.data();
        const totais    = f.parcelasTotais || 1;
        const datas     = f.datasParcelas  || [];
        const historico = f.historicoParc  || [];
        const vCliente  = parseFloat(f.valorCliente || f.valor || 0);
        const vLiquido  = parseFloat(f.valorLiquido || f.valor || 0);
        const isCartao  = f.pagamento === 'Cartão';
        const taxa      = isCartao ? (vCliente - vLiquido) : 0;

        const totalPago     = historico.reduce((acc, h) => acc + parseFloat(h.valorPago || 0), 0);
        const saldoRestante = parseFloat((vLiquido - totalPago).toFixed(2));
        const vParcOriginal = parseFloat((vLiquido / totais).toFixed(2));

        let tabelaHTML = `
            <div style="margin:12px 0; border-top:1px solid #333; padding-top:10px;">
                <p style="color:#888; font-size:11px; margin:0 0 8px 0;
                    text-transform:uppercase; letter-spacing:1px;">📋 Parcelas</p>`;

        let acumuladoPago = 0;
        for (let i = 0; i < totais; i++) {
            const dataPrev          = datas[i] || '---';
            const valorDestaParcela = vParcOriginal;
            const acumuladoAntes    = acumuladoPago;

            historico.forEach(h => {
                if (h.parcela === i + 1) acumuladoPago += parseFloat(h.valorPago || 0);
            });

            const pagoNestaParcela = parseFloat((acumuladoPago - acumuladoAntes).toFixed(2));
            const parcelaQuitada   = pagoNestaParcela >= valorDestaParcela - 0.01;
            const pagamentoParcial = pagoNestaParcela > 0 && !parcelaQuitada;
            const histParc         = historico.find(h => h.parcela === i + 1);
            const dataPago         = histParc ? histParc.dataPago : null;

            tabelaHTML += `
                <div style="display:flex; justify-content:space-between;
                    align-items:center; font-size:11px; padding:6px 8px;
                    margin:3px 0; border-radius:4px;
                    background:${parcelaQuitada ? 'rgba(0,255,0,0.07)' : pagamentoParcial ? 'rgba(255,165,0,0.07)' : 'rgba(255,77,77,0.07)'};
                    border-left:3px solid ${parcelaQuitada ? '#00ff00' : pagamentoParcial ? 'orange' : '#ff4d4d'};">
                    <span style="color:#aaa; min-width:65px;">Parcela ${i+1}/${totais}</span>
                    <span style="color:${parcelaQuitada ? '#888' : 'var(--gold)'};">📅 ${dataPrev}</span>
                    ${parcelaQuitada ? `
                        <div style="text-align:right;">
                            <span style="color:#00ff00; display:block;">✅ Pago em ${dataPago || '---'}</span>
                            <span style="color:var(--gold); font-size:10px;">💰 R$ ${pagoNestaParcela.toFixed(2)}</span>
                        </div>
                    ` : pagamentoParcial ? `
                        <div style="text-align:right;">
                            <span style="color:orange; display:block; font-weight:bold;">⚡ Parcial: R$ ${pagoNestaParcela.toFixed(2)}</span>
                            <span style="color:#ff4d4d; font-size:10px;">Falta: R$ ${(valorDestaParcela - pagoNestaParcela).toFixed(2)}</span>
                        </div>
                    ` : `<span style="color:#ff4d4d; font-weight:bold;">⏳ Pendente</span>`}
                </div>`;
        }
        tabelaHTML += `</div>`;

        let histHTML = '';
        if (historico.length > 0) {
            histHTML = `
                <div style="margin:8px 0; padding:10px; background:#0a1a0a;
                    border-radius:6px; border:1px solid #1a3a1a;">
                    <p style="color:#888; font-size:10px; margin:0 0 6px 0;
                        text-transform:uppercase; letter-spacing:1px;">
                        💵 Histórico de Recebimentos
                    </p>`;
            historico.forEach((h, idx) => {
                histHTML += `
                    <div style="display:flex; justify-content:space-between;
                        font-size:11px; padding:4px 0; border-bottom:1px solid #1a2a1a;">
                        <span style="color:#aaa;">#${idx+1} — ${h.dataPago || '---'}</span>
                        <span style="color:#00ff00; font-weight:bold;">
                            + R$ ${parseFloat(h.valorPago || 0).toFixed(2)}
                        </span>
                    </div>`;
            });
            histHTML += `
                    <div style="display:flex; justify-content:space-between;
                        font-size:12px; padding:6px 0 0 0; margin-top:4px;
                        border-top:1px solid #333;">
                        <span style="color:#aaa;">Total recebido:</span>
                        <span style="color:#00ff00; font-weight:bold;">R$ ${totalPago.toFixed(2)}</span>
                    </div>
                </div>`;
        }

        lista.innerHTML += `
            <div class="card">
                <div style="display:flex; justify-content:space-between;
                    align-items:center; border-bottom:1px solid #333;
                    padding-bottom:8px; margin-bottom:8px;">
                    <strong>👤 ${f.cliente}</strong>
                    <div style="text-align:right;">
                        <div style="color:#aaa; font-size:11px;">
                            Total: <span style="color:white;">R$ ${vCliente.toFixed(2)}</span>
                        </div>
                        ${isCartao ? `<div style="color:#ff4d4d; font-size:10px;">💳 Taxa: -R$ ${taxa.toFixed(2)}</div>` : ''}
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.85em; color:#aaa;">
                    <span>🌸 ${f.perfume}</span>
                    <span>${totais} parcela(s)</span>
                </div>
                ${f.contato  ? `<p style="font-size:0.8em; color:#666; margin:6px 0 0 0;">📱 ${f.contato}</p>` : ''}
                ${f.endereco ? `<p style="font-size:0.8em; color:#666; margin:2px 0 0 0;">📍 ${f.endereco}</p>` : ''}
                <div style="margin:12px 0; padding:12px;
                    background:${saldoRestante <= 0 ? 'rgba(0,255,0,0.07)' : 'rgba(255,77,77,0.07)'};
                    border-radius:8px;
                    border:1px solid ${saldoRestante <= 0 ? '#00ff00' : '#ff4d4d'};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#aaa; font-size:12px;">💰 Total recebido:</span>
                        <span style="color:#00ff00; font-weight:bold;">R$ ${totalPago.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                        <span style="color:#aaa; font-size:12px;">⚠️ Saldo em aberto:</span>
                        <span style="color:${saldoRestante <= 0 ? '#00ff00' : '#ff4d4d'};
                            font-size:1.3em; font-weight:bold;">
                            R$ ${saldoRestante.toFixed(2)}
                        </span>
                    </div>
                </div>
                ${tabelaHTML}
                ${histHTML}
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
                    <button class="btn-pago" onclick="pagarUmaParcela('${d.id}')">
                        💰 PAGAR PARCELA
                    </button>
                    <button onclick="quitarTotal('${d.id}')"
                        style="background:#222; border:1px solid var(--gold);
                        color:var(--gold); font-size:10px; padding:8px;
                        border-radius:6px; cursor:pointer; font-weight:bold;">
                        ✅ QUITAR TUDO
                    </button>
                </div>
                <div style="margin-top:8px;">
                    <button onclick="estornarPagamentoFiado('${d.id}')"
                        style="width:100%; background:#2a1a2a;
                        border:1px solid #bf7fff; color:#bf7fff;
                        font-size:10px; padding:8px; border-radius:6px;
                        cursor:pointer; font-weight:bold;">
                        ↩️ ESTORNAR ÚLTIMO PAGAMENTO
                    </button>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
                    <button onclick="abrirModalEdicaoFiado('${d.id}')"
                        style="background:#1a3a2a; border:1px solid #00ff00;
                        color:#00ff00; font-size:10px; padding:8px;
                        border-radius:6px; cursor:pointer; font-weight:bold;">
                        ✏️ EDITAR DATAS
                    </button>
                    <button onclick="excluirFiado('${d.id}')"
                        style="background:#222; border:1px solid #ff4d4d;
                        color:#ff4d4d; font-size:10px; padding:8px;
                        border-radius:6px; cursor:pointer; font-weight:bold;">
                        🗑️ EXCLUIR
                    </button>
                </div>
            </div>`;
    });
}

window.pagarUmaParcela = async function(id) {
    const ref       = doc(db, "vendas", id);
    const s         = await getDoc(ref);
    const f         = s.data();
    const totais    = f.parcelasTotais || 1;
    const historico = [...(f.historicoParc || [])];
    const vLiquido  = parseFloat(f.valorLiquido || f.valor || 0);

    const totalJaPago   = historico.reduce((acc, h) => acc + parseFloat(h.valorPago || 0), 0);
    const saldoRestante = parseFloat((vLiquido - totalJaPago).toFixed(2));

    if (saldoRestante <= 0) return alert("🎉 Este fiado já está totalmente quitado!");

    const valorDigitado = prompt(
        `💰 Registrar Pagamento\n\n` +
        `📊 Total do fiado:    R$ ${vLiquido.toFixed(2)}\n` +
        `✅ Já recebido:       R$ ${totalJaPago.toFixed(2)}\n` +
        `⚠️  Saldo em aberto:  R$ ${saldoRestante.toFixed(2)}\n\n` +
        `Informe o valor recebido agora:`,
        saldoRestante.toFixed(2)
    );

    if (valorDigitado === null) return;
    const valorPago = parseFloat(valorDigitado);
    if (isNaN(valorPago) || valorPago <= 0) return alert("⚠️ Valor inválido!");

    const valorFinal = parseFloat(Math.min(valorPago, saldoRestante).toFixed(2));
    const hoje       = new Date().toISOString().split('T')[0];
    const saldoApos  = parseFloat((saldoRestante - valorFinal).toFixed(2));

    historico.push({
        parcela:   historico.length + 1,
        dataPago:  hoje,
        valorPago: valorFinal
    });

    const novasParcelasPagas = saldoApos <= 0 ? totais : (f.parcelasPagas || 0);
    const statusFinal        = saldoApos <= 0 ? 'Pago' : 'Pendente';

    await updateDoc(ref, {
        parcelasPagas: novasParcelasPagas,
        historicoParc: historico,
        status:        statusFinal,
        saldoRestante: saldoApos
    });

    if (saldoApos <= 0) {
        alert(`🎉 Fiado quitado!\n\n💰 Último pagamento: R$ ${valorFinal.toFixed(2)}\n✅ Tudo pago!`);
    } else {
        const proxData = (f.datasParcelas || [])[0] || '---';
        alert(
            `✅ Pagamento registrado!\n\n` +
            `💰 Recebido agora:   R$ ${valorFinal.toFixed(2)}\n` +
            `⚠️  Ainda falta:      R$ ${saldoApos.toFixed(2)}\n\n` +
            `📅 Vencimento:       ${proxData}`
        );
    }
    window.carregarFiados();
}

window.quitarTotal = async function(id) {
    if (!confirm("Quitar todas as parcelas de uma vez?")) return;
    const ref  = doc(db, "vendas", id);
    const s    = await getDoc(ref);
    const f    = s.data();
    const hoje = new Date().toISOString().split('T')[0];
    const historico = f.historicoParc || [];
    const jaPagas   = historico.length;
    for (let i = jaPagas; i < (f.parcelasTotais || 1); i++) {
        historico.push({ parcela: i + 1, dataPago: hoje });
    }
    await updateDoc(ref, {
        parcelasPagas: f.parcelasTotais,
        historicoParc: historico,
        status:        'Pago'
    });
    alert("🎉 Fiado quitado com sucesso!");
    window.carregarFiados();
}

window.abrirModalEdicaoFiado = async function(id) {
    const ref    = doc(db, "vendas", id);
    const s      = await getDoc(ref);
    const f      = s.data();
    const totais = f.parcelasTotais || 1;
    const datas  = f.datasParcelas  || [];

    document.getElementById('modal-edicao-fiado')?.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-edicao-fiado';
    modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.85); z-index:9999;
        display:flex; align-items:center; justify-content:center;
        padding:20px; box-sizing:border-box;`;

    modal.innerHTML = `
        <div style="background:#1a1a1a; border:1px solid var(--gold);
            border-radius:12px; padding:25px; width:100%;
            max-width:420px; max-height:90vh; overflow-y:auto;">
            <h3 style="color:var(--gold); text-align:center; margin:0 0 5px 0;">✏️ EDITAR FIADO</h3>
            <p style="color:#888; font-size:12px; text-align:center; margin:0 0 20px 0;">
                👤 ${f.cliente} — 🌸 ${f.perfume}
            </p>
            <label style="color:var(--gold); font-size:11px; font-weight:bold; text-transform:uppercase;">
                📋 Número de Parcelas
            </label>
            <input type="number" id="medit-total-parcelas"
                value="${totais}" min="1" max="24"
                onchange="window.recalcularParcelasModal(${JSON.stringify(datas).replace(/"/g, "'")})"
                style="width:100%; padding:10px; margin:5px 0 15px;
                background:#222; border:1px solid var(--gold);
                color:white; border-radius:5px; box-sizing:border-box; font-size:16px;">
            <div id="medit-campos-datas"></div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button onclick="salvarEdicaoFiadoCompleto('${id}')"
                    style="flex:1; background:linear-gradient(45deg,#d4af37,#f9e29c);
                    color:black; border:none; padding:12px;
                    border-radius:5px; font-weight:bold; cursor:pointer;">
                    💾 SALVAR
                </button>
                <button onclick="document.getElementById('modal-edicao-fiado').remove()"
                    style="flex:1; background:none; border:1px solid #ff4d4d;
                    color:#ff4d4d; padding:12px; border-radius:5px; cursor:pointer;">
                    ✖ CANCELAR
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    window.recalcularParcelasModal(datas);
}

window.recalcularParcelasModal = function(datasAtuais) {
    const qtd       = parseInt(document.getElementById('medit-total-parcelas')?.value) || 1;
    const container = document.getElementById('medit-campos-datas');
    if (!container) return;
    container.innerHTML = "";

    for (let i = 0; i < qtd; i++) {
        let dataVal = (datasAtuais && datasAtuais[i]) ? datasAtuais[i] : "";
        if (!dataVal) {
            const d = new Date();
            d.setMonth(d.getMonth() + i + 1);
            dataVal = d.toISOString().split('T')[0];
        }
        container.innerHTML += `
            <div style="margin-bottom:10px;">
                <label style="color:var(--gold); font-size:11px;
                    font-weight:bold; text-transform:uppercase;">
                    📅 Vencimento Parcela ${i + 1}/${qtd}
                </label>
                <input type="date" id="medit-data-${i}" value="${dataVal}"
                    style="width:100%; padding:10px; margin-top:4px;
                    background:#222; border:1px solid #444;
                    color:white; border-radius:5px;
                    box-sizing:border-box; font-size:16px;">
            </div>`;
    }
}

window.salvarEdicaoFiadoCompleto = async function(id) {
    const novoTotal  = parseInt(document.getElementById('medit-total-parcelas')?.value) || 1;
    const novasDatas = [];

    for (let i = 0; i < novoTotal; i++) {
        const campo = document.getElementById(`medit-data-${i}`);
        const data  = campo ? campo.value : "";
        if (!data) return alert(`⚠️ Informe a data da parcela ${i + 1}!`);
        novasDatas.push(data);
    }

    try {
        const ref   = doc(db, "vendas", id);
        const s     = await getDoc(ref);
        const f     = s.data();
        const pagas = Math.min(f.parcelasPagas || 0, novoTotal);

        await updateDoc(ref, {
            parcelasTotais: novoTotal,
            parcelasPagas:  pagas,
            datasParcelas:  novasDatas,
            status: pagas >= novoTotal ? 'Pago' : 'Pendente'
        });

        document.getElementById('modal-edicao-fiado').remove();
        alert("✅ Fiado atualizado!");
        window.carregarFiados();
    } catch(e) {
        alert("Erro ao salvar: " + e.message);
    }
}

window.excluirFiado = async function(id) {
    if (confirm("Excluir este fiado definitivamente?")) {
        await deleteDoc(doc(db, "vendas", id));
        window.carregarFiados();
    }
}

// =============================================
// 5. HISTÓRICO
// =============================================
window.carregarVendidos = async function() {
    const snap = await getDocs(
        query(collection(db, "vendas"), where("status", "==", "Pago"))
    );
    vendasParaBusca = [];
    snap.forEach(d => vendasParaBusca.push({ id: d.id, ...d.data() }));
    window.filtrarHistorico();
}

window.filtrarHistorico = function() {
    const termo = (document.getElementById('busca-historico')?.value || "").toUpperCase();
    const lista = document.getElementById('lista-vendidos');
    lista.innerHTML = "";

    if (vendasParaBusca.length === 0) {
        lista.innerHTML = `<div style="text-align:center; color:#888; padding:30px;">Nenhuma venda encontrada.</div>`;
        return;
    }

    vendasParaBusca.filter(v =>
        (v.perfume || "").toUpperCase().includes(termo) ||
        (v.cliente || "").toUpperCase().includes(termo)
    ).forEach(v => {
        const eFiado   = v.pagamento === 'Fiado';
        const isCartao = v.pagamento === 'Cartão';
        const vCliente = parseFloat(v.valorCliente || v.valor || 0);
        const vLiquido = parseFloat(v.valorLiquido || v.valor || 0);
        const taxa     = isCartao ? (vCliente - vLiquido) : 0;

        const pNome = (v.perfume  || '').replace(/'/g, '');
        const cNome = (v.cliente  || '').replace(/'/g, '');
        const cCont = (v.contato  || '').replace(/'/g, '');
        const cEnd  = (v.endereco || '').replace(/'/g, '');

        lista.innerHTML += `
            <div class="card" style="margin-bottom:12px;">
                <div style="margin-bottom:10px;">
                    <strong style="font-size:1.05em; color:white;">🌸 ${v.perfume}</strong><br>
                    <small style="color:#aaa;">👤 ${v.cliente}</small><br>
                    <small style="color:#666;">
                        📅 ${v.data || ''} —
                        <span style="color:${
                            isCartao ? '#ff4d4d' :
                            v.pagamento === 'PIX' ? '#00ff00' :
                            v.pagamento === 'Dinheiro' ? '#4da6ff' : 'var(--gold)'
                        };">${v.pagamento || ''}</span>
                    </small>
                </div>
                <div style="padding:10px; background:#111; border-radius:6px;
                    margin-bottom:12px;
                    border-left:3px solid ${isCartao ? '#ff4d4d' : '#00ff00'};">
                    ${isCartao ? `
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:#aaa; margin-bottom:4px;">
                            <span>💳 Cliente pagou:</span>
                            <span style="color:white;">R$ ${vCliente.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:#ff4d4d; margin-bottom:4px;">
                            <span>Taxa operadora (12%):</span>
                            <span>-R$ ${taxa.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:var(--gold);">
                            <span>✅ Você recebeu:</span>
                            <span>R$ ${vLiquido.toFixed(2)}</span>
                        </div>
                    ` : `
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:#aaa; margin-bottom:4px;">
                            <span>${v.pagamento === 'PIX' ? '💚 PIX' : v.pagamento === 'Dinheiro' ? '💵 Dinheiro' : '⚠️ Fiado'} — Cliente pagou:</span>
                            <span style="color:white;">R$ ${vCliente.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:var(--gold);">
                            <span>✅ Você recebeu:</span>
                            <span>R$ ${vLiquido.toFixed(2)}</span>
                        </div>
                    `}
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <button onclick="abrirModalEdicao('${v.id}','${pNome}','${cNome}','${cCont}','${cEnd}','${vLiquido}','${v.pagamento}','${v.data || ''}','historico')"
                        style="background:#1a3a2a; border:1px solid #00ff00; color:#00ff00;
                        padding:10px 8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        ✏️ EDITAR
                    </button>
                    ${eFiado ? `
                    <button onclick="estornarParaFiado('${v.id}')"
                        style="background:#3a3a1a; border:1px solid var(--gold); color:var(--gold);
                        padding:10px 8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        ↩ VOLTAR FIADO
                    </button>` : `<div></div>`}
                    <button onclick="estornarParaPendente('${v.id}')"
                        style="background:#1a2a3a; border:1px solid #4da6ff; color:#4da6ff;
                        padding:10px 8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        ↩ DESFAZER
                    </button>
                    <button onclick="excluirVenda('${v.id}')"
                        style="background:#2a1a1a; border:1px solid #ff4d4d; color:#ff4d4d;
                        padding:10px 8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        🗑️ EXCLUIR
                    </button>
                </div>
            </div>`;
    });
}

window.excluirVenda = async function(id) {
    if (confirm("Excluir esta venda definitivamente?")) {
        await deleteDoc(doc(db, "vendas", id));
        window.carregarVendidos();
    }
}

window.estornarParaFiado = async function(id) {
    if (!confirm("Voltar esta venda para a aba Fiado?\n\nOs pagamentos registrados serão apagados.")) return;
    const ref = doc(db, "vendas", id);
    const s   = await getDoc(ref);
    const f   = s.data();
    await updateDoc(ref, {
        status:           'Pendente',
        parcelasPagas:    0,
        historicoParc:    [],
        saldoRestante:    parseFloat(f.valorLiquido || f.valor || 0),
        valorProxParcela: 0
    });
    window.carregarVendidos();
}

window.estornarParaPendente = async function(id) {
    if (!confirm("Desfazer esta venda?\n\nOs pagamentos registrados serão apagados.")) return;
    const ref = doc(db, "vendas", id);
    const s   = await getDoc(ref);
    const f   = s.data();
    await updateDoc(ref, {
        status:           'Pendente',
        parcelasPagas:    0,
        historicoParc:    [],
        saldoRestante:    parseFloat(f.valorLiquido || f.valor || 0),
        valorProxParcela: 0
    });
    window.carregarVendidos();
}

window.estornarPagamentoFiado = async function(id) {
    const ref       = doc(db, "vendas", id);
    const s         = await getDoc(ref);
    const f         = s.data();
    const historico = f.historicoParc || [];

    if (historico.length === 0)
        return alert("⚠️ Nenhum pagamento registrado para estornar!");

    const ultimoPagamento = historico[historico.length - 1];
    const ok = confirm(
        `⚠️ Estornar último pagamento?\n\n` +
        `📋 Parcela: ${ultimoPagamento.parcela}\n` +
        `💰 Valor pago: R$ ${parseFloat(ultimoPagamento.valorPago || 0).toFixed(2)}\n` +
        `📅 Data: ${ultimoPagamento.dataPago}\n\n` +
        `O valor será zerado e o saldo voltará ao estado anterior.`
    );
    if (!ok) return;

    historico.pop();

    const vLiquido  = parseFloat(f.valorLiquido || f.valor || 0);
    const totalPago = historico.reduce((acc, h) => acc + parseFloat(h.valorPago || 0), 0);
    const novoSaldo = parseFloat((vLiquido - totalPago).toFixed(2));

    const novasParcPagas  = historico.length;
    const parcelasAbertas = (f.parcelasTotais || 1) - novasParcPagas;
    const novoValorParc   = parcelasAbertas > 0
        ? parseFloat((novoSaldo / parcelasAbertas).toFixed(2))
        : 0;

    await updateDoc(ref, {
        status:           novoSaldo <= 0 ? 'Pago' : 'Pendente',
        parcelasPagas:    novasParcPagas,
        historicoParc:    historico,
        saldoRestante:    novoSaldo,
        valorProxParcela: novoValorParc
    });

    alert(
        `✅ Pagamento estornado!\n\n` +
        `⚠️  Saldo em aberto agora: R$ ${novoSaldo.toFixed(2)}\n` +
        `📋 Parcelas em aberto: ${parcelasAbertas}`
    );
    window.carregarFiados();
}

// =============================================
// MODAL EDIÇÃO DE VENDA
// =============================================
window.abrirModalEdicao = function(id, perfume, cliente, contato, endereco, valor, pagamento, data, origem) {
    document.getElementById('modal-edicao')?.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-edicao';
    modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.85); z-index:9999;
        display:flex; align-items:center; justify-content:center;
        padding:20px; box-sizing:border-box;`;

    modal.innerHTML = `
        <div style="background:#1a1a1a; border:1px solid var(--gold);
            border-radius:12px; padding:25px; width:100%;
            max-width:480px; max-height:90vh; overflow-y:auto;">
            <h3 style="color:var(--gold); text-align:center; margin:0 0 20px 0;">✏️ EDITAR VENDA</h3>
            <label style="color:var(--gold); font-size:11px; font-weight:bold;">DATA</label>
            <input type="date" id="edit-data" value="${data}"
                style="width:100%; padding:10px; margin:5px 0 12px; background:#222;
                border:1px solid #444; color:white; border-radius:5px; box-sizing:border-box;">
            <label style="color:var(--gold); font-size:11px; font-weight:bold;">PERFUME</label>
            <input type="text" id="edit-perfume" value="${perfume}"
                style="width:100%; padding:10px; margin:5px 0 12px; background:#222;
                border:1px solid #444; color:white; border-radius:5px; box-sizing:border-box;">
            <label style="color:var(--gold); font-size:11px; font-weight:bold;">CLIENTE</label>
            <input type="text" id="edit-cliente" value="${cliente}"
                style="width:100%; padding:10px; margin:5px 0 12px; background:#222;
                border:1px solid #444; color:white; border-radius:5px; box-sizing:border-box;">
            <label style="color:var(--gold); font-size:11px; font-weight:bold;">WHATSAPP</label>
            <input type="text" id="edit-contato" value="${contato}"
                style="width:100%; padding:10px; margin:5px 0 12px; background:#222;
                border:1px solid #444; color:white; border-radius:5px; box-sizing:border-box;">
            <label style="color:var(--gold); font-size:11px; font-weight:bold;">ENDEREÇO</label>
            <input type="text" id="edit-endereco" value="${endereco}"
                style="width:100%; padding:10px; margin:5px 0 12px; background:#222;
                border:1px solid #444; color:white; border-radius:5px; box-sizing:border-box;">
            <label style="color:var(--gold); font-size:11px; font-weight:bold;">VALOR (R$)</label>
            <input type="number" id="edit-valor" value="${valor}"
                style="width:100%; padding:10px; margin:5px 0 12px; background:#222;
                border:1px solid #444; color:white; border-radius:5px; box-sizing:border-box;">
            <label style="color:var(--gold); font-size:11px; font-weight:bold;">PAGAMENTO</label>
            <select id="edit-pagamento"
                style="width:100%; padding:10px; margin:5px 0 20px; background:#222;
                border:1px solid #444; color:white; border-radius:5px; box-sizing:border-box;">
                <option value="PIX"      ${pagamento==='PIX'      ?'selected':''}>💚 PIX</option>
                <option value="Dinheiro" ${pagamento==='Dinheiro' ?'selected':''}>💵 Dinheiro</option>
                <option value="Cartão"   ${pagamento==='Cartão'   ?'selected':''}>💳 Cartão</option>
                <option value="Fiado"    ${pagamento==='Fiado'    ?'selected':''}>⚠️ Fiado</option>
            </select>
            <div style="display:flex; gap:10px;">
                <button onclick="salvarEdicaoVenda('${id}','${origem}')"
                    style="flex:1; background:linear-gradient(45deg,#d4af37,#f9e29c);
                    color:black; border:none; padding:12px;
                    border-radius:5px; font-weight:bold; cursor:pointer;">
                    💾 SALVAR
                </button>
                <button onclick="document.getElementById('modal-edicao').remove()"
                    style="flex:1; background:none; border:1px solid #ff4d4d;
                    color:#ff4d4d; padding:12px; border-radius:5px; cursor:pointer;">
                    ✖ CANCELAR
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

window.salvarEdicaoVenda = async function(id, origem) {
    try {
        await updateDoc(doc(db, "vendas", id), {
            data:      document.getElementById('edit-data').value,
            perfume:   document.getElementById('edit-perfume').value.toUpperCase().trim(),
            cliente:   document.getElementById('edit-cliente').value.toUpperCase().trim(),
            contato:   document.getElementById('edit-contato').value.trim(),
            endereco:  document.getElementById('edit-endereco').value.trim(),
            valor:     parseFloat(document.getElementById('edit-valor').value) || 0,
            pagamento: document.getElementById('edit-pagamento').value
        });
        document.getElementById('modal-edicao').remove();
        alert("✅ Venda atualizada!");
        origem === 'fiado' ? window.carregarFiados() : window.carregarVendidos();
    } catch(e) {
        alert("Erro ao salvar: " + e.message);
    }
}

// =============================================
// 6. CLIENTES
// =============================================
window.carregarClientes = async function() {
    const lista     = document.getElementById('lista-clientes');
    const sugestoes = document.getElementById('lista-sugestao-clientes');
    lista.innerHTML = "";
    if (sugestoes) sugestoes.innerHTML = "";

    const snap = await getDocs(collection(db, "clientes"));

    if (snap.empty) {
        lista.innerHTML = `<div style="text-align:center; color:#888; padding:30px;">Nenhum cliente cadastrado ainda.</div>`;
        return;
    }

    snap.forEach(d => {
        const c = d.data();
        if (sugestoes) sugestoes.innerHTML += `<option value="${c.nome}">`;
        lista.innerHTML += `
            <div class="card">
                <div style="cursor:pointer; padding:5px 0;"
                    onclick="irParaVendaCliente('${(c.nome||'').replace(/'/g,'')}','${(c.contato||'').replace(/'/g,'')}','${(c.endereco||'').replace(/'/g,'')}')"
                    title="Clique para iniciar uma venda">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:var(--gold);">👤 ${c.nome || '---'}</strong>
                        <span style="font-size:10px; color:#888;">👆 toque para vender</span>
                    </div>
                    <p style="margin:5px 0; color:#aaa; font-size:0.9em;">📱 ${c.contato || '---'}</p>
                    <p style="margin:5px 0; color:#aaa; font-size:0.9em;">📍 ${c.endereco || '---'}</p>
                </div>
                <div style="text-align:right; margin-top:8px;">
                    <button onclick="event.stopPropagation(); excluirCliente('${d.id}')"
                        style="background:none; border:1px solid #ff4d4d; color:#ff4d4d;
                        padding:5px 10px; border-radius:4px; cursor:pointer; font-size:11px;">
                        🗑️ EXCLUIR
                    </button>
                </div>
            </div>`;
    });
}

window.irParaVendaCliente = async function(nome, contato, endereco) {
    abrirAba('vendas');
    await new Promise(r => setTimeout(r, 300));
    const c = document.getElementById('v-cliente');
    const t = document.getElementById('v-contato');
    const e = document.getElementById('v-endereco');
    if (c) c.value = nome;
    if (t) t.value = contato;
    if (e) e.value = endereco;
    document.getElementById('v-perfume')?.focus();
}

window.excluirCliente = async function(id) {
    if (confirm("Excluir este cliente definitivamente?")) {
        await deleteDoc(doc(db, "clientes", id));
        window.carregarClientes();
    }
}

// =============================================
// 7. RELATÓRIOS
// =============================================
window.gerarRelatorio = async function() {
    try {
        const hoje      = new Date();
        const ano       = hoje.getFullYear();
        const mes       = String(hoje.getMonth() + 1).padStart(2, '0');
        const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate();

        const inputInicio = document.getElementById('rel-inicio');
        const inputFim    = document.getElementById('rel-fim');

        if (!inputInicio.value) inputInicio.value = `${ano}-${mes}-01`;
        if (!inputFim.value)    inputFim.value    = `${ano}-${mes}-${ultimoDia}`;

        const inicio = inputInicio.value;
        const fim    = inputFim.value;

        const snapProdutos = await getDocs(collection(db, "produtos"));
        const mapaProdutos = {};
        snapProdutos.forEach(d => {
            const data = d.data();
            mapaProdutos[d.id] = data;
            const nome = (data.nome || "").toUpperCase().trim();
            if (nome) mapaProdutos[nome] = data;
        });

        const snapVendas = await getDocs(collection(db, "vendas"));

        let totalGeral         = 0;
        let totalPix           = 0;
        let totalCartao        = 0;
        let totalCartaoBruto   = 0;
        let totalTaxaCartao    = 0;
        let totalDinheiro      = 0;
        let totalFiado         = 0;
        let qtdVendas          = 0;
        let totalLucro         = 0;
        let totalCustos        = 0;
        let totalFreteDespesa  = 0;
        let totalDeslocDespesa = 0;
        const prodContagem     = {};
        const vendasPeriodo    = [];

        snapVendas.forEach(d => {
            const v = d.data();
            if (v.status !== "Pago") return;
            if ((v.data || "") < inicio || (v.data || "") > fim) return;

            const vLiquido = parseFloat(v.valorLiquido || v.valor || 0);
            const vCliente = parseFloat(v.valorCliente || v.valor || 0);
            const pag      = (v.pagamento || "").trim();
            const retirada = v.retirada || false;

            totalGeral += vLiquido;
            qtdVendas++;
            vendasPeriodo.push({ ...v, _vLiquido: vLiquido, _vCliente: vCliente });

            let custoVenda  = parseFloat(v.custoTotal  || 0);
            let freteVenda  = parseFloat(v.freteTotal  || 0);
            let deslocVenda = parseFloat(v.deslocTotal || 0);

            if (custoVenda === 0 && v.itens && v.itens.length > 0) {
                v.itens.forEach(item => {
                    let prod = mapaProdutos[item.idProd];
                    if (!prod && item.nome) {
                        const nomeItem = (item.nome || "").toUpperCase().trim();
                        prod = mapaProdutos[nomeItem];
                        if (!prod) {
                            prod = Object.values(mapaProdutos).find(p =>
                                p && p.nome &&
                                (nomeItem.includes((p.nome || "").toUpperCase().trim()) ||
                                (p.nome || "").toUpperCase().trim().includes(nomeItem))
                            );
                        }
                    }
                    if (prod) {
                        const qtd = item.qtd || 1;
                        custoVenda  += parseFloat(prod.custo        || prod.custoUnitario || 0) * qtd;
                        freteVenda  += parseFloat(prod.frete        || 0) * qtd;
                        deslocVenda += parseFloat(prod.deslocamento || 0) * qtd;
                    }
                });
            }

            if (custoVenda === 0 && v.perfume) {
                const nomePerfume = (v.perfume || "").toUpperCase().trim();
                let prod = mapaProdutos[nomePerfume];
                if (!prod) {
                    prod = Object.values(mapaProdutos).find(p =>
                        p && p.nome && typeof p.nome === 'string' &&
                        (nomePerfume.includes((p.nome || "").toUpperCase().trim()) ||
                        (p.nome || "").toUpperCase().trim().includes(nomePerfume))
                    );
                }
                if (prod) {
                    custoVenda  = parseFloat(prod.custo        || prod.custoUnitario || 0);
                    freteVenda  = parseFloat(prod.frete        || 0);
                    deslocVenda = parseFloat(prod.deslocamento || 0);
                }
            }

            const freteDespesa  = retirada ? 0 : freteVenda;
            const deslocDespesa = deslocVenda;
            const lucroVenda    = custoVenda > 0
                ? (vLiquido - custoVenda - freteDespesa - deslocDespesa)
                : 0;

            totalLucro         += lucroVenda;
            totalCustos        += custoVenda;
            totalFreteDespesa  += freteDespesa;
            totalDeslocDespesa += deslocDespesa;

            if      (pag === "PIX")     { totalPix          += vLiquido; }
            else if (pag === "Cartão")  {
                totalCartao      += vLiquido;
                totalCartaoBruto += vCliente;
                totalTaxaCartao  += (vCliente - vLiquido);
            }
            else if (pag === "Dinheiro"){ totalDinheiro      += vLiquido; }
            else if (pag === "Fiado")   { totalFiado         += vLiquido; }

            const np = v.perfume || "Desconhecido";
            prodContagem[np] = (prodContagem[np] || 0) + 1;
        });

        let maisVendido = "—", maxV = 0;
        for (const [n, q] of Object.entries(prodContagem)) {
            if (q > maxV) { maxV = q; maisVendido = `${n} (${q}x)`; }
        }

        const snapPend = await getDocs(
            query(collection(db, "vendas"), where("status", "==", "Pendente"))
        );
        let totalPendente = 0;
        snapPend.forEach(d => {
            totalPendente += parseFloat(d.data().valorLiquido || d.data().valor || 0);
        });

        const set = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.innerText = v;
        };

        set('rel-total',        `R$ ${totalGeral.toFixed(2)}`);
        set('rel-qtd',           qtdVendas);
        set('rel-pix',          `R$ ${totalPix.toFixed(2)}`);
        set('rel-cartao',       `R$ ${totalCartao.toFixed(2)}`);
        set('rel-dinheiro',     `R$ ${totalDinheiro.toFixed(2)}`);
        set('rel-fiado',        `R$ ${totalFiado.toFixed(2)}`);
        set('rel-pendente',     `R$ ${totalPendente.toFixed(2)}`);
        set('rel-mais-vendido',  maisVendido);
        set('rel-taxa-cartao',  `R$ ${totalTaxaCartao.toFixed(2)}`);
        set('rel-cartao-bruto', `R$ ${totalCartaoBruto.toFixed(2)}`);
        set('rel-total-geral',  `R$ ${(totalGeral + totalPendente).toFixed(2)}`);
        set('rel-lucro',        `R$ ${totalLucro.toFixed(2)}`);
        set('rel-lucro-receita',`R$ ${totalGeral.toFixed(2)}`);
        set('rel-lucro-custo',  `-R$ ${totalCustos.toFixed(2)}`);
        set('rel-lucro-frete',  `-R$ ${totalFreteDespesa.toFixed(2)}`);
        set('rel-lucro-desloc', `-R$ ${totalDeslocDespesa.toFixed(2)}`);

        const listaEl = document.getElementById('lista-rel-vendas');
        if (!listaEl) return;

        if (vendasPeriodo.length === 0) {
            listaEl.innerHTML = `
                <div style="text-align:center; color:#888; padding:20px;">
                    Nenhuma venda no período
                </div>`;
            return;
        }

        vendasPeriodo.sort((a, b) => (b.data || "").localeCompare(a.data || ""));

        listaEl.innerHTML = vendasPeriodo.map(v => {
            const pag = v.pagamento || "";
            const isC = pag === "Cartão";
            const vL  = v._vLiquido;
            const vC  = v._vCliente;
            const tx  = isC ? (vC - vL) : 0;
            const cor = pag === "PIX"      ? "#00ff00" :
                        pag === "Cartão"   ? "#ff4d4d" :
                        pag === "Dinheiro" ? "#4da6ff" : "var(--gold)";
            return `
                <div style="display:flex; justify-content:space-between;
                    align-items:flex-start; padding:12px; margin-bottom:8px;
                    background:#111; border-radius:8px;
                    border-left:3px solid ${cor};">
                    <div style="flex:1;">
                        <strong style="color:white;">🌸 ${v.perfume || "—"}</strong><br>
                        <small style="color:#aaa;">👤 ${v.cliente || "—"}</small><br>
                        <small style="color:#666;">📅 ${v.data || "—"}</small>
                    </div>
                    <div style="text-align:right; min-width:120px;">
                        ${isC ? `
                            <div style="font-size:10px; color:#aaa;">Cliente: R$ ${vC.toFixed(2)}</div>
                            <div style="font-size:10px; color:#ff4d4d;">Taxa: -R$ ${tx.toFixed(2)}</div>
                        ` : ''}
                        <div style="font-weight:bold; color:var(--gold);">R$ ${vL.toFixed(2)}</div>
                        <small style="color:${cor}; font-weight:bold;">${pag}</small>
                    </div>
                </div>`;
        }).join("");

    } catch(e) {
        console.error("Erro no relatório:", e);
        alert("❌ Erro ao gerar relatório: " + e.message);
    }
}

// =============================================
// INICIALIZAÇÃO
// =============================================
window.onload = async function() {
    await window.carregarEstoque();
};

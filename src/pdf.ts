import fs from 'fs'
import { XMLParser } from 'fast-xml-parser'

/**
 * Impressão da NFS-e da Prefeitura de São Paulo (PDF local a partir do XML), para quando o link
 * público da Prefeitura não serve (ex.: anexar o PDF ao e-mail).
 */

const TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; padding: 0; }
        .invoice-box {
            max-width: 800px;
            margin: auto;
            padding: 5px;
            border: 2px solid #003366;
            position: relative;
            background-image: repeating-linear-gradient(
                -45deg,
                rgba(0, 51, 102, 0.03),
                rgba(0, 51, 102, 0.03) 1px,
                transparent 1px,
                transparent 15px
            );
        }
        .table-section { width: 100%; border-collapse: collapse; margin-bottom: 5px; border: 1px solid #003366; background-color: rgba(255, 255, 255, 0.9); }
        .table-section td { border: 1px solid #003366; padding: 5px; vertical-align: top; }
        .bg-blue { background-color: #003366; color: white; font-weight: bold; font-size: 11px; padding: 3px 5px !important; }
        .text-center { text-align: center; }
        .title { font-size: 14px; font-weight: bold; color: #003366; }
        .label { font-weight: bold; color: #333; display: block; margin-bottom: 2px; text-transform: uppercase; font-size: 9px; }
        .value { font-size: 11px; }
        .disc-text { min-height: 250px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; background: #fff; }
        .grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid #003366; border-top: none; background-color: #fff; }
        .grid-col { border-right: 1px solid #003366; padding: 5px; }
        .grid-col:last-child { border-right: none; }
        .logo-container { text-align: center; padding-top: 5px; }
        .logo-text { font-family: 'Arial Black', sans-serif; font-size: 10px; color: #003366; line-height: 1.1; margin-top: 4px; font-weight: 900; }
    </style>
</head>
<body>
<div class="invoice-box">
    <!-- Bloco 1: Identificação -->
    <table class="table-section">
        <tr>
            <td width="22%" class="text-center">
                <div class="logo-container">
                    <svg width="45" height="45" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M50 5L80 20V50C80 70 50 95 50 95C50 95 20 70 20 50V20L50 5Z" stroke="#003366" stroke-width="6" fill="#fff"/>
                        <path d="M35 35H65M35 50H65M50 35V65" stroke="#003366" stroke-width="5" stroke-linecap="round"/>
                        <path d="M28 17L50 5L72 17" stroke="#003366" stroke-width="4"/>
                    </svg>
                    <div class="logo-text">PREFEITURA DE<br>SÃO PAULO</div>
                </div>
            </td>
            <td width="53%" class="text-center" style="vertical-align: middle;">
                <span class="title">Nota Fiscal Eletrônica de Serviços - NFS-e</span><br>
                <span style="font-size: 10px; font-weight: bold; color: #555;">RPS Nº Mod. Série emitido em ambiente oficial</span>
            </td>
            <td width="25%">
                <span class="label">Número da Nota</span>
                <span class="value" style="font-size: 15px; font-weight: bold; color: #cc0000;">{{numeroNota}}</span><br><br>
                <span class="label">Data de Emissão</span>
                <span class="value" style="font-weight: bold;">{{dataEmissao}}</span>
            </td>
        </tr>
        <tr>
            <td colspan="2">
                <span class="label">Código de Verificação</span>
                <span class="value" style="font-family: monospace; font-weight: bold; font-size: 13px; color: #003366; letter-spacing: 1px;">{{codigoVerificacao}}</span>
            </td>
            <td>
                <span class="label">Inscrição Prestador</span>
                <span class="value">{{prestador.inscricaoMunicipal}}</span>
            </td>
        </tr>
    </table>

    <!-- Bloco 2: Prestador -->
    <table class="table-section">
        <tr><td class="bg-blue">PRESTADOR DE SERVIÇOS</td></tr>
        <tr>
            <td>
                <span class="label">CPF/CNPJ: {{prestador.cnpj}}</span>
                <strong class="value" style="font-size: 12px; color: #003366;">{{prestador.nome}}</strong><br>
                <span class="value">Endereço: {{prestador.endereco}}</span>
            </td>
        </tr>
    </table>

    <!-- Bloco 3: Tomador -->
    <table class="table-section">
        <tr><td class="bg-blue">TOMADOR DE SERVIÇOS</td></tr>
        <tr>
            <td>
                <span class="label">CPF/CNPJ: {{tomador.cnpjCpf}} | Inscrição Municipal: {{tomador.inscricaoMunicipal}}</span>
                <strong class="value" style="font-size: 12px; color: #003366;">{{tomador.nome}}</strong><br>
                <span class="value">Endereço: {{tomador.endereco}}</span><br>
                <span class="value">E-mail: {{tomador.email}}</span>
            </td>
        </tr>
    </table>

    <!-- Bloco 4: Discriminação dos Serviços -->
    <table class="table-section">
        <tr><td class="bg-blue">DISCRIMINAÇÃO DOS SERVIÇOS</td></tr>
        <tr>
            <td class="disc-text">{{servico.discriminacao}}</td>
        </tr>
    </table>

    <!-- Bloco 5: Tributos Federais -->
    <table class="table-section">
        <tr><td class="bg-blue" colspan="4">RETENÇÕES DE TRIBUTOS FEDERAIS</td></tr>
        <tr>
            <td width="25%"><span class="label">PIS (R$)</span><span class="value">{{formatMoney servico.pis}}</span></td>
            <td width="25%"><span class="label">COFINS (R$)</span><span class="value">{{formatMoney servico.cofins}}</span></td>
            <td width="25%"><span class="label">CSLL (R$)</span><span class="value">{{formatMoney servico.csll}}</span></td>
            <td width="25%"><span class="label">IRRF (R$)</span><span class="value">{{formatMoney servico.irrf}}</span></td>
        </tr>
    </table>

    <!-- Bloco 6: Valores e Totais -->
    <div class="grid-5">
        <div class="grid-col"><span class="label">Vl. Total Serviços (R$)</span><span class="value"><strong>{{formatMoney servico.valorTotal}}</strong></span></div>
        <div class="grid-col"><span class="label">Deduções (R$)</span><span class="value">{{formatMoney servico.valorDeducoes}}</span></div>
        <div class="grid-col"><span class="label">Base Cálculo (R$)</span><span class="value">{{formatMoney servico.baseCalculo}}</span></div>
        <div class="grid-col"><span class="label">Alíquota (%)</span><span class="value">{{servico.aliquota}}%</span></div>
        <div class="grid-col"><span class="label">Valor do ISS (R$)</span><span class="value">{{formatMoney servico.valorIss}}</span></div>
    </div>
    <div class="grid-5" style="border-top: none;">
        <div class="grid-col" style="grid-column: span 2;"><span class="label">ISS Retido</span><span class="value" style="font-weight: bold;">{{servico.issRetido}}</span></div>
        <div class="grid-col" style="grid-column: span 3; background-color: #e6f2ff;"><span class="label" style="color: #003366; font-weight: bold;">Valor Líquido da Nota (R$)</span><span class="value" style="font-size: 15px; font-weight: bold; color: #003366;">{{formatMoney servico.valorLiquido}}</span></div>
    </div>
</div>
</body>
</html>`


const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === 0 || value === '') return '0,00'
  return parseFloat(String(value)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Substitui `{{caminho.campo}}` e `{{formatMoney caminho}}` (valores escapados). */
function renderizar(template: string, dados: Record<string, any>): string {
  const ler = (caminho: string) => caminho.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), dados)
  return template.replace(/\{\{\s*(?:(formatMoney)\s+)?([\w.]+)\s*\}\}/g, (_, fmt, caminho) =>
    esc(fmt ? formatMoney(ler(caminho)) : ler(caminho)),
  )
}

type No = Record<string, any>

function buildAddress(node: No | null | undefined): string {
  if (!node) return ''
  const parts = [
    [node['TipoLogradouro'], node['Logradouro']].filter(Boolean).join(' '),
    node['NumeroEndereco'] ?? node['Numero'],
    node['ComplementoEndereco'],
    node['Bairro'],
    node['UF'],
  ].filter(Boolean).join(', ')
  const cep = node['CEP'] ? ` — CEP: ${String(node['CEP']).padStart(8, '0').replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : ''
  return parts + cep
}

function fmtDoc(no: No | null | undefined): string {
  const s = String(no?.CNPJ ?? no?.CPF ?? '').replace(/\D/g, '')
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return s
}

function fmtData(raw: unknown): string {
  const s = String(raw ?? '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/)
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ' ' + m[4] : ''}` : s
}

/**
 * HTML da NFS-e SP (A4) a partir do XML retornado pela Prefeitura (RetornoConsulta / ComprovanteEnvio / NFe).
 * Aceita o leiaute real do webservice (RazaoSocialPrestador, CPFCNPJTomador, EnderecoTomador...) e
 * o agrupado (Prestador/Tomador). Converta com o motor HTML→PDF que quiser, ou use `gerarNfsePdf`.
 */
export function gerarNfseHtml(xmlString: string): string {
  const parser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: false, parseTagValue: false })
  const jsonObj = parser.parse(xmlString)

  const raiz = jsonObj?.RetornoConsulta?.NFe ?? jsonObj?.ComprovanteEnvio?.NFe ?? jsonObj?.NFe ?? null
  const nota: No | null = Array.isArray(raiz) ? raiz[0] : raiz
  if (!nota) throw new Error('[nfse-sp] Estrutura da NFS-e não encontrada no XML.')

  const chave: No = nota.ChaveNFe ?? {}
  const prest: No = nota.Prestador ?? {}
  const toma: No = nota.Tomador ?? {}
  const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v))
  const aliquota = n(nota.AliquotaServicos ?? nota.Aliquota)
  const valorServicos = n(nota.ValorServicos)

  const dadosNota = {
    numeroNota: String(chave.NumeroNFe ?? ''),
    codigoVerificacao: String(chave.CodigoVerificacao ?? ''),
    dataEmissao: fmtData(nota.DataEmissaoNFe ?? nota.DataEmissao),
    prestador: {
      nome: String(nota.RazaoSocialPrestador ?? prest.RazaoSocial ?? ''),
      cnpj: fmtDoc(nota.CPFCNPJPrestador ?? prest.CPFCNPJ ?? prest),
      inscricaoMunicipal: String(chave.InscricaoPrestador ?? prest.InscricaoMunicipal ?? ''),
      endereco: buildAddress(nota.EnderecoPrestador ?? prest.Endereco ?? prest),
    },
    tomador: {
      nome: String(nota.RazaoSocialTomador ?? toma.RazaoSocial ?? ''),
      cnpjCpf: fmtDoc(nota.CPFCNPJTomador ?? toma.CPFCNPJ),
      inscricaoMunicipal: String(nota.InscricaoMunicipalTomador ?? toma.InscricaoMunicipal ?? 'Não Informada'),
      endereco: buildAddress(nota.EnderecoTomador ?? toma.Endereco ?? toma),
      email: String(nota.EmailTomador ?? toma.Email ?? ''),
    },
    servico: {
      discriminacao: String(nota.Discriminacao ?? '').replace(/\|/g, '\n'),
      valorTotal: valorServicos,
      valorDeducoes: n(nota.ValorDeducoes),
      baseCalculo: nota.BaseCalculo != null ? n(nota.BaseCalculo) : valorServicos,
      // AliquotaServicos vem em fração (0.05 = 5%).
      aliquota: (aliquota < 1 ? aliquota * 100 : aliquota).toFixed(2),
      valorIss: n(nota.ValorISS ?? nota.ValorIss),
      issRetido: String(nota.ISSRetido) === 'true' ? 'SIM' : 'NÃO',
      pis: n(nota.ValorPIS),
      cofins: n(nota.ValorCOFINS),
      csll: n(nota.ValorCSLL),
      irrf: n(nota.ValorIR ?? nota.ValorIRRF),
      valorLiquido: nota.ValorLiquido != null ? n(nota.ValorLiquido) : valorServicos,
    },
  }

  return renderizar(TEMPLATE_HTML, dadosNota)
}

export interface OpcoesPdf {
  /** Caminho do Chrome/Chromium. Padrão: o do puppeteer (ou /usr/bin/google-chrome se existir). */
  executablePath?: string
  /** Browser puppeteer já aberto (reaproveitado em lote; não é fechado aqui). */
  browser?: any
}

/**
 * PDF da NFS-e SP gerado localmente a partir do XML.
 * Requer o pacote `puppeteer` instalado no projeto (dependência opcional).
 */
export async function gerarNfsePdf(xmlString: string, opcoes: OpcoesPdf = {}): Promise<Buffer> {
  const html = gerarNfseHtml(xmlString)
  let browser = opcoes.browser
  if (!browser) {
    let puppeteer: any
    try {
      const nome = 'puppeteer'
      puppeteer = (await import(nome)).default
    } catch {
      throw new Error('[nfse-sp] gerarNfsePdf requer o pacote "puppeteer" (npm i puppeteer). Alternativa: gerarNfseHtml + seu próprio conversor.')
    }
    const executablePath =
      opcoes.executablePath ?? (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined)
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], ...(executablePath ? { executablePath } : {}) })
  }
  try {
    const page = await browser.newPage()
    try {
      await page.setContent(html, { waitUntil: 'load' })
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '15px', bottom: '15px', left: '15px', right: '15px' } })
      return Buffer.from(pdf)
    } finally {
      await page.close()
    }
  } finally {
    if (!opcoes.browser) await browser.close()
  }
}

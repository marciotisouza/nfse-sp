import * as https from 'https'
import axios from 'axios'
import { DOMParser } from '@xmldom/xmldom'
import { extrairPemTls } from './certificate.js'

const WS_URL = 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx'
const NS     = 'http://www.prefeitura.sp.gov.br/nfe'

const SOAP_ACTIONS: Record<string, string> = {
  EnvioRPS:               'envioRPS',
  EnvioLoteRPS:           'envioLoteRPS',
  TesteEnvioLoteRPS:      'testeenvio',
  CancelamentoNFe:        'cancelamentoNFe',
  ConsultaNFe:            'consultaNFe',
  ConsultaNFeRecebidas:   'consultaNFeRecebidas',
  ConsultaNFeEmitidas:    'consultaNFeEmitidas',
  ConsultaLote:           'consultaLote',
  ConsultaInformacoesLote:'consultaInformacoesLote',
  ConsultaCNPJ:           'consultaCNPJ',
}

export interface RetornoSoap {
  sucesso: boolean
  erros?: Array<{ codigo: string | null; descricao: string | null }>
  xmlCompleto?: string
  numeroNfe?: string | null
  protocoloLote?: string | null
  linkNfe?: string | null
  situacaoNfe?: string | null
  /** Lista de NFS-e retornadas pelo ConsultaLote quando o lote tem múltiplas notas. */
  nfeList?: Array<{ numeroNfe: string; numeroRps: string; linkNfe?: string | null }>
}

export async function executarRequisicaoSoap(
  xmlAssinado: string,
  operacao: string,
  pfxBuf: Buffer,
  pfxSenha: string,
): Promise<RetornoSoap> {
  const action = SOAP_ACTIONS[operacao] ?? operacao

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${operacao}Request xmlns="${NS}">
      <VersaoSchema>1</VersaoSchema>
      <MensagemXML><![CDATA[${xmlAssinado}]]></MensagemXML>
    </${operacao}Request>
  </soap:Body>
</soap:Envelope>`.trim()

  // key/cert PEM em vez de { pfx, passphrase }: o Node 22 / OpenSSL 3 recusa o .pfx legado.
  const httpsAgent = new https.Agent({
    ...extrairPemTls(pfxBuf, pfxSenha),
    rejectUnauthorized: true,
  })

  const resposta = await axios.post(WS_URL, soapEnvelope, {
    httpsAgent,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${NS}/ws/${action}"`,
    },
    timeout: 30_000,
    validateStatus: () => true,
  })

  return interpretarResposta(resposta.data as string)
}

function interpretarResposta(xmlResposta: string): RetornoSoap {
  const retornoMatch = xmlResposta.match(/<RetornoXML>([\s\S]*?)<\/RetornoXML>/)
  const xmlInterno = retornoMatch
    ? retornoMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    : xmlResposta

  const doc   = new DOMParser().parseFromString(xmlInterno, 'application/xml')
  const erros = doc.getElementsByTagName('Erro')

  if (erros.length > 0) {
    const listaErros = []
    for (let i = 0; i < erros.length; i++) {
      listaErros.push({
        codigo:    erros[i].getElementsByTagName('Codigo')?.[0]?.textContent ?? null,
        descricao: erros[i].getElementsByTagName('Descricao')?.[0]?.textContent ?? null,
      })
    }
    return { sucesso: false, erros: listaErros }
  }

  if (doc.getElementsByTagName('Sucesso')?.[0]?.textContent === 'false') {
    return { sucesso: false, erros: [] }
  }

  const protocoloLote = doc.getElementsByTagName('NumeroLote')?.[0]?.textContent ?? null
  const situacaoNfe   = doc.getElementsByTagName('Situacao')?.[0]?.textContent ?? null

  const nfeEls = doc.getElementsByTagName('NFe')
  if (nfeEls.length > 1 || (nfeEls.length === 1 && doc.getElementsByTagName('NumeroNFe').length > 1)) {
    const nfeList: RetornoSoap['nfeList'] = []
    for (let i = 0; i < nfeEls.length; i++) {
      const el       = nfeEls[i]
      const numeroNfe = el.getElementsByTagName('NumeroNFe')?.[0]?.textContent ?? ''
      const numeroRps = el.getElementsByTagName('NumeroRPS')?.[0]?.textContent ?? ''
      const link      = el.getElementsByTagName('Link')?.[0]?.textContent ?? null
      if (numeroNfe) nfeList.push({ numeroNfe, numeroRps, linkNfe: link })
    }
    return { sucesso: true, xmlCompleto: xmlInterno, protocoloLote, situacaoNfe, nfeList }
  }

  return {
    sucesso: true,
    xmlCompleto:  xmlInterno,
    numeroNfe:    doc.getElementsByTagName('NumeroNFe')?.[0]?.textContent ?? null,
    protocoloLote,
    linkNfe:      doc.getElementsByTagName('Link')?.[0]?.textContent ?? null,
    situacaoNfe,
  }
}

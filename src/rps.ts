import forge from 'node-forge'
import { extrairDadosCertificado } from './certificate.js'
import { assinarXmlDocumento } from './sign.js'
import { executarRequisicaoSoap, type RetornoSoap } from './soap.js'

export interface DadosRps {
  /** Inscrição municipal do prestador (8 dígitos) */
  inscricaoPrestador: string
  /** Série do RPS (até 5 chars, ex: "RPS") */
  serieRps: string
  /** Número sequencial do RPS */
  numeroRps: string
  /** Data de emissão formato AAAAMMDD */
  dataEmissao: string
  /** Data de emissão formato ISO (AAAA-MM-DDTHH:mm:ss) */
  dataEmissaoFormated: string
  /** Tipo do RPS: "1" = RPS, "2" = RPS-M, "3" = MEI */
  tipoRps: string
  /** Status do RPS: "N" = Normal, "C" = Cancelado */
  statusRps: string
  /** Tributação: "T" = Tributado no município */
  tributacaoRps: string
  /** Valor dos serviços como string (ex: "1500.00") */
  valorServicos: string
  /** Valor dos serviços como número (para cálculo do total do lote) */
  valorServicosFloat: number
  /** Valor das deduções (ex: "0.00") */
  valorDeducoes: string
  /** Código do serviço conforme lista LC 116/2003 de SP (5 dígitos) */
  codigoServico: string
  /** "J" para CNPJ, "F" para CPF */
  indicadorCnpjCpf: string
  /** CNPJ (14 dígitos) ou CPF (11 dígitos) do tomador, sem pontuação */
  documentoTomador: string
  /** Razão social ou nome do tomador */
  razaoTomador: string
  /** Alíquota ISS (ex: 0.06 para 6%) */
  aliquota: number
  /** Descrição do serviço prestado */
  discriminacao: string
  /** Código IBGE do município do tomador (7 dígitos) */
  enderecoCidade?: string | null
  /** UF do tomador (2 letras, ex: "SP") */
  enderecoUf?: string | null
  /** Logradouro completo do tomador (com ou sem prefixo "Rua", "Av.", etc.) */
  enderecoLogradouro?: string | null
  /** Número do endereço */
  enderecoNumero?: string | null
  /** Bairro do tomador */
  enderecoBairro?: string | null
  /** CEP do tomador (8 dígitos, sem pontuação) */
  enderecoCep?: string | null
}

const PREFIXOS_LOGRADOURO: Record<string, string> = {
  AV: 'Avenida', AVENIDA: 'Avenida',
  R: 'Rua',      RUA: 'Rua',
  AL: 'Alameda', ALAMEDA: 'Alameda',
  PC: 'Praça',   PRACA: 'Praça',
  TR: 'Travessa',TRAVESSA: 'Travessa',
  EST: 'Estrada',ESTRADA: 'Estrada',
  ROD: 'Rodovia',RODOVIA: 'Rodovia',
}

function inferirTipoLogradouro(logradouro: string): string {
  const primeiro = logradouro.trim().toUpperCase().split(/\s+/)[0]
  return PREFIXOS_LOGRADOURO[primeiro] ?? 'Rua'
}

function removerPrefixoLogradouro(logradouro: string): string {
  const partes  = logradouro.trim().split(/\s+/)
  const prefixo = partes[0].toUpperCase()
  return PREFIXOS_LOGRADOURO[prefixo] ? partes.slice(1).join(' ') : logradouro
}

/**
 * Gera a assinatura posicional SHA1 do RPS conforme o protocolo da Prefeitura de SP.
 * A string de assinatura é formada concatenando campos em posições fixas.
 */
export function gerarAssinaturaRps(
  dados: DadosRps,
  privateKeyForge: forge.pki.rsa.PrivateKey,
): string {
  const indicadorNumerico = dados.indicadorCnpjCpf === 'J' ? '2' : '1'

  const stringAssinar =
    dados.inscricaoPrestador.padStart(8, '0') +
    dados.serieRps.padEnd(5, ' ') +
    dados.numeroRps.padStart(12, '0') +
    dados.dataEmissao +
    dados.tributacaoRps +
    dados.statusRps +
    'N' +                                                     // ISSRetido = false
    dados.valorServicos.replace('.', '').padStart(15, '0') +
    dados.valorDeducoes.replace('.', '').padStart(15, '0') +
    dados.codigoServico.padStart(5, '0') +
    indicadorNumerico +
    dados.documentoTomador.padStart(14, '0')

  const md = forge.md.sha1.create()
  md.update(stringAssinar, 'utf8')
  return forge.util.encode64(privateKeyForge.sign(md))
}

function montarXmlRps(dados: DadosRps, assinatura: string): string {
  const dataEmissao = dados.dataEmissaoFormated.slice(0, 10)
  const docTag      = dados.indicadorCnpjCpf === 'J' ? 'CNPJ' : 'CPF'

  const enderecoXml =
    dados.enderecoCidade && dados.enderecoUf
      ? `    <EnderecoTomador>
${dados.enderecoLogradouro ? `      <TipoLogradouro>${inferirTipoLogradouro(dados.enderecoLogradouro)}</TipoLogradouro>
      <Logradouro>${removerPrefixoLogradouro(dados.enderecoLogradouro)}</Logradouro>` : ''}
${dados.enderecoNumero ? `      <NumeroEndereco>${dados.enderecoNumero}</NumeroEndereco>` : ''}
${dados.enderecoBairro ? `      <Bairro>${dados.enderecoBairro}</Bairro>` : ''}
      <Cidade>${dados.enderecoCidade}</Cidade>
      <UF>${dados.enderecoUf}</UF>
${dados.enderecoCep ? `      <CEP>${dados.enderecoCep.replace(/\D/g, '').slice(0, 8)}</CEP>` : ''}
    </EnderecoTomador>`
      : ''

  return `  <RPS>
    <Assinatura>${assinatura}</Assinatura>
    <ChaveRPS>
      <InscricaoPrestador>${dados.inscricaoPrestador}</InscricaoPrestador>
      <SerieRPS>${dados.serieRps}</SerieRPS>
      <NumeroRPS>${dados.numeroRps}</NumeroRPS>
    </ChaveRPS>
    <TipoRPS>RPS</TipoRPS>
    <DataEmissao>${dataEmissao}</DataEmissao>
    <StatusRPS>${dados.statusRps}</StatusRPS>
    <TributacaoRPS>${dados.tributacaoRps}</TributacaoRPS>
    <ValorServicos>${dados.valorServicosFloat.toFixed(2)}</ValorServicos>
    <ValorDeducoes>0.00</ValorDeducoes>
    <CodigoServico>${dados.codigoServico}</CodigoServico>
    <AliquotaServicos>${dados.aliquota}</AliquotaServicos>
    <ISSRetido>false</ISSRetido>
    <CPFCNPJTomador><${docTag}>${dados.documentoTomador}</${docTag}></CPFCNPJTomador>
    <RazaoSocialTomador>${dados.razaoTomador}</RazaoSocialTomador>
${enderecoXml}
    <Discriminacao>${dados.discriminacao}</Discriminacao>
  </RPS>`
}

/**
 * Envia múltiplos RPS em um único lote SOAP (EnvioLoteRPS ou TesteEnvioLoteRPS).
 * Cada RPS recebe sua assinatura SHA1 interna; o documento completo é assinado via XML-DSig.
 *
 * @param lote        Array de RPS a enviar (mínimo 1)
 * @param pfxBuf      Buffer do certificado A1 (.pfx/.p12)
 * @param pfxSenha    Senha do certificado
 * @param cnpjPrestador CNPJ do prestador (14 dígitos, sem pontuação)
 * @param teste       Se true, usa TesteEnvioLoteRPS (valida sem emitir nota real)
 */
export async function enviarLoteRps(
  lote: DadosRps[],
  pfxBuf: Buffer,
  pfxSenha: string,
  cnpjPrestador: string,
  teste = false,
): Promise<RetornoSoap> {
  if (lote.length === 0) throw new Error('Lote não pode ser vazio.')

  const { privateKeyPem, certBase64, privateKeyForge } = extrairDadosCertificado(pfxBuf, pfxSenha)

  const datas        = lote.map(d => d.dataEmissaoFormated.slice(0, 10)).sort()
  const dtInicio     = datas[0]
  const dtFim        = datas[datas.length - 1]
  const totalServicos = lote.reduce((s, d) => s + d.valorServicosFloat, 0)

  const blocos = lote.map(d => montarXmlRps(d, gerarAssinaturaRps(d, privateKeyForge)))

  const xmlBruto = `<?xml version="1.0" encoding="UTF-8"?>
<p1:PedidoEnvioLoteRPS xmlns:p1="http://www.prefeitura.sp.gov.br/nfe">
  <Cabecalho Versao="1">
    <CPFCNPJRemetente><CNPJ>${cnpjPrestador}</CNPJ></CPFCNPJRemetente>
    <transacao>false</transacao>
    <dtInicio>${dtInicio}</dtInicio>
    <dtFim>${dtFim}</dtFim>
    <QtdRPS>${lote.length}</QtdRPS>
    <ValorTotalServicos>${totalServicos.toFixed(2)}</ValorTotalServicos>
    <ValorTotalDeducoes>0.00</ValorTotalDeducoes>
  </Cabecalho>
${blocos.join('\n')}
</p1:PedidoEnvioLoteRPS>`.trim()

  const xmlAssinado = assinarXmlDocumento(xmlBruto, privateKeyPem, certBase64)
  const operacao    = teste ? 'TesteEnvioLoteRPS' : 'EnvioLoteRPS'
  return executarRequisicaoSoap(xmlAssinado, operacao, pfxBuf, pfxSenha)
}

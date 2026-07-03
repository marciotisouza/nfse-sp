/**
 * Exemplo: emitir NFS-e em lote para a Prefeitura de São Paulo.
 *
 * Execute: npx tsx examples/emitir-lote.ts
 */
import { readFileSync } from 'fs'
import { NfseSpClient, type DadosRps } from '../src/index.js'

const client = new NfseSpClient({
  pfxBuf:            Buffer.from(process.env.CERT_BASE64 ?? '', 'base64'),
  pfxSenha:          process.env.CERT_SENHA ?? '',
  cnpjPrestador:     process.env.CNPJ_PRESTADOR ?? '',
  inscricaoMunicipal:process.env.INSCRICAO_MUNICIPAL ?? '',
  codigoServico:     process.env.CODIGO_SERVICO ?? '',
})

const rps: DadosRps = {
  inscricaoPrestador:  process.env.INSCRICAO_MUNICIPAL ?? '',
  serieRps:            'RPS',
  numeroRps:           '1',                    // use o ID da fatura como número
  dataEmissao:         '20260701',             // AAAAMMDD
  dataEmissaoFormated: '2026-07-01T00:00:00',  // para o XML
  tipoRps:             '1',
  statusRps:           'N',
  tributacaoRps:       'T',
  valorServicos:       '1500.00',
  valorServicosFloat:  1500.00,
  valorDeducoes:       '0.00',
  codigoServico:       process.env.CODIGO_SERVICO ?? '',
  indicadorCnpjCpf:    'J',
  documentoTomador:    '12345678000195',        // CNPJ do tomador (14 dígitos)
  razaoTomador:        'EMPRESA TOMADORA LTDA',
  aliquota:            0.06,                   // 6% ISS
  discriminacao:       'Serviços de tecnologia da informação',
  // Endereço do tomador (obrigatório para tomadores CNPJ em SP)
  enderecoCidade:      '3550308',              // código IBGE de São Paulo
  enderecoUf:          'SP',
  enderecoLogradouro:  'Avenida Paulista',
  enderecoNumero:      '1000',
  enderecoBairro:      'Bela Vista',
  enderecoCep:         '01310100',
}

// Usa TesteEnvioLoteRPS — muda para { teste: false } para emitir de verdade
const retorno = await client.emitirLote([rps], { teste: true })

console.log('Sucesso:', retorno.sucesso)

if (retorno.sucesso) {
  console.log('Protocolo lote:', retorno.protocoloLote ?? '— (modo teste retorna 0)')
  console.log('Número NFS-e: ', retorno.numeroNfe ?? '— (assíncrono, consulte o lote)')
} else {
  console.error('Erros:')
  retorno.erros?.forEach(e => console.error(`  [${e.codigo}] ${e.descricao}`))
}

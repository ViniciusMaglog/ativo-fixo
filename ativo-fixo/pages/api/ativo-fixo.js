import nodemailer from 'nodemailer';
import formidable from 'formidable';
import html_to_pdf from 'html-pdf-node';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Configuração do PDF
const pdfOptions = { format: 'A4', printBackground: true };

// Função para gerar o HTML do PDF (Formato Documento)
const generatePDFHtml = (fields, tableRows) => {
    const dataSolicitacao = new Date().toLocaleDateString('pt-BR');
    
    return `
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            h1 { text-align: center; color: #000; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header-info { margin-bottom: 30px; }
            .header-info p { margin: 5px 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: center; }
            th { background-color: #f0f0f0; }
            .obs-box { border: 1px solid #333; padding: 10px; min-height: 60px; margin-bottom: 20px; font-size: 12px;}
            
            /* Estilo da área de assinatura */
            .signature-section { margin-top: 60px; display: flex; justify-content: space-between; }
            .sign-box { width: 45%; text-align: center; }
            .sign-line { border-top: 1px solid #000; margin-bottom: 5px; }
            .sign-name { font-weight: bold; text-transform: uppercase; font-size: 12px; }
            .sign-role { font-size: 11px; color: #555; }
            
            .urgency { font-weight: bold; margin-bottom: 20px; color: #000; }
        </style>
    </head>
    <body>
        <h1>SOLICITAÇÃO DE ATIVO FIXO</h1>
        
        <div class="header-info">
            <p><strong>Solicitante:</strong> ${fields.nome}</p>
            <p><strong>Setor:</strong> ${fields.setor}</p>
            <p><strong>Data da Solicitação:</strong> ${dataSolicitacao}</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="text-align: left;">BEM (Descrição)</th>
                    <th>PATRIMÔNIO</th>
                    <th>TIPO</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows.map(row => `
                    <tr>
                        <td style="text-align: left;">${row.bem}</td>
                        <td>${row.patrimonio || '---'}</td>
                        <td>${row.tipo}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <p><strong>Observações:</strong></p>
        <div class="obs-box">
            ${fields.observacao || 'Sem observações.'}
        </div>

        <p class="urgency">NÍVEL DE URGÊNCIA: ${fields.urgencia.toUpperCase()}</p>

        <div class="signature-section">
            <div style="width: 100%; display: flex; justify-content: space-between;">
                
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <div class="sign-name">${fields.nome}</div>
                    <div class="sign-role">Solicitante</div>
                    <div class="sign-role">Data: ${dataSolicitacao}</div>
                </div>

                <div class="sign-box">
                    <div class="sign-line"></div>
                    <div class="sign-name">Gestão / Aprovação</div>
                    <div class="sign-role">Assinatura Responsável</div>
                    <div class="sign-role">Data: ____/____/______</div>
                </div>

            </div>
        </div>
    </body>
    </html>
    `;
};

async function enviarNotificacaoDiscord(fields, tableRows) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL; // Lembre de mudar se for um canal diferente
  if (!webhookUrl) return;

  const colorMap = {
      'Baixa': 0x00FF00,  // Verde
      'Média': 0xFFFF00,  // Amarelo
      'Alta': 0xFF0000    // Vermelho
  };

  const itensDescricao = tableRows.map(row => 
      `📦 **${row.tipo}** - ${row.bem} ${row.patrimonio ? `(Pat: ${row.patrimonio})` : ''}`
  ).join('\n');

  const payload = {
    content: `🏢 **Nova Solicitação de ATIVO FIXO**`,
    embeds: [
      {
        title: 'Detalhes da Movimentação de Ativo',
        color: colorMap[fields.urgencia] || 0x0099ff,
        fields: [
          { name: 'Solicitante', value: fields.nome, inline: true },
          { name: 'Setor', value: fields.setor, inline: true },
          { name: 'Urgência', value: fields.urgencia, inline: true },
          { name: 'Itens', value: itensDescricao || 'Nenhum item' },
          { name: 'Observações', value: fields.observacao || 'Nenhuma' },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Sistema Maglog - Ativo Fixo' },
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Erro Discord:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const form = formidable({ multiples: true });

  try {
    const { fields } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const getVal = (v) => Array.isArray(v) ? v[0] : v;
    
    // Processar campos simples
    const dados = {
        nome: getVal(fields.nome),
        setor: getVal(fields.setor),
        observacao: getVal(fields.observacao),
        urgencia: getVal(fields.urgencia),
    };

    // Processar tabela dinâmica
    const tableRows = [];
    const count = parseInt(getVal(fields.row_count) || '0');
    
    for (let i = 0; i < count; i++) {
        const bem = getVal(fields[`bem_${i}`]);
        if (bem) {
            tableRows.push({
                bem: bem,
                patrimonio: getVal(fields[`patrimonio_${i}`]),
                tipo: getVal(fields[`tipo_${i}`]) // RAF, TAF ou BAF
            });
        }
    }

    // Gerar PDF
    const htmlContent = generatePDFHtml(dados, tableRows);
    const file = { content: htmlContent };
    
    const pdfBuffer = await html_to_pdf.generatePdf(file, pdfOptions);

    // Enviar E-mail
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: process.env.EMAIL_SERVER_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"${dados.nome}" <${process.env.EMAIL_FROM}>`,
      to: process.env.EMAIL_TO,
      subject: `Solicitação Ativo Fixo - ${dados.setor}`,
      text: `Segue em anexo a solicitação de ativo fixo gerada pelo sistema.\nSolicitante: ${dados.nome}\nUrgência: ${dados.urgencia}`,
      attachments: [
          {
              filename: `AtivoFixo_${dados.nome.replace(/\s/g, '_')}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf'
          }
      ]
    };

    await transporter.sendMail(mailOptions);
    await enviarNotificacaoDiscord(dados, tableRows);

    return res.status(200).json({ message: 'Solicitação enviada e PDF gerado!' });

  } catch (error) {
    console.error('Erro geral:', error);
    return res.status(500).json({ message: error.message || 'Erro interno.' });
  }
}
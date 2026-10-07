import nodemailer from 'nodemailer';
import formidable from 'formidable';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const config = {
  api: {
    bodyParser: false,
  },
};

// ======================================================
// GERAÇÃO DO PDF
// ======================================================
const generatePDFBuffer = (fields, tableRows) => {
  const doc = new jsPDF();

  const dataSolicitacao = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });

  // ====================================================
  // CABEÇALHO
  // ====================================================
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');

  doc.text('SOLICITAÇÃO DE ATIVO FIXO', 105, 20, {
    align: 'center',
  });

  doc.setLineWidth(0.5);
  doc.line(20, 25, 190, 25);

  // ====================================================
  // DADOS DO SOLICITANTE
  // ====================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');

  let yPos = 40;

  doc.text(
    `Solicitante: ${fields.nome || ''}`,
    20,
    yPos
  );

  yPos += 8;

  doc.text(
    `Setor: ${fields.setor || ''}`,
    20,
    yPos
  );

  yPos += 8;

  doc.text(
    `Data da Solicitação: ${dataSolicitacao}`,
    20,
    yPos
  );

  // ====================================================
  // TABELA DE ITENS
  // ====================================================
  const bodyData = tableRows.map((row) => {
    let setorPreenchimento = '';

    const tipo = row.tipo
      ? row.tipo.toUpperCase()
      : '';

    // RAF e BAF não precisam de setor destino
    if (tipo === 'RAF' || tipo === 'BAF') {
      setorPreenchimento = 'N/A';
    }

    // TAF deixa o campo em branco para preenchimento
    else if (tipo === 'TAF') {
      setorPreenchimento = '';
    }

    return [
      row.bem || '',
      row.patrimonio || '---',
      row.tipo || '',
      setorPreenchimento,
    ];
  });

  autoTable(doc, {
    startY: yPos + 10,

    head: [
      [
        'BEM (Descrição)',
        'PATRIMÔNIO',
        'TIPO',
        'SETOR DESTINO',
      ],
    ],

    body: bodyData,

    theme: 'grid',

    headStyles: {
      fillColor: [220, 220, 220],
      textColor: 20,
      lineColor: 0,
    },

    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
  });

  // ====================================================
  // POSIÇÃO FINAL DA TABELA
  // ====================================================
  let finalY = doc.lastAutoTable.finalY + 15;

  // ====================================================
  // OBSERVAÇÕES
  // ====================================================
  doc.setFont('helvetica', 'bold');

  doc.text(
    'Observações:',
    20,
    finalY
  );

  finalY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const obsText = doc.splitTextToSize(
    fields.observacao || 'Sem observações.',
    170
  );

  doc.text(
    obsText,
    20,
    finalY
  );

  finalY += (obsText.length * 5) + 10;

  // ====================================================
  // URGÊNCIA
  // ====================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');

  doc.text(
    `NÍVEL DE URGÊNCIA: ${
      (fields.urgencia || '').toUpperCase()
    }`,
    20,
    finalY
  );

  // ====================================================
  // ASSINATURAS
  // ====================================================
  if (finalY > 240) {
    doc.addPage();
    finalY = 40;
  } else {
    finalY += 40;
  }

  const pageHeight =
    doc.internal.pageSize.height;

  const assinaturaY =
    finalY > pageHeight - 40
      ? pageHeight - 40
      : finalY;

  // ----------------------------------------------------
  // ASSINATURA ESQUERDA
  // ----------------------------------------------------
  doc.setLineWidth(0.2);

  doc.line(
    20,
    assinaturaY,
    90,
    assinaturaY
  );

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  doc.text(
    (fields.nome || '').toUpperCase(),
    55,
    assinaturaY + 5,
    {
      align: 'center',
    }
  );

  doc.setFont(
    'helvetica',
    'normal'
  );

  doc.setFontSize(9);

  doc.text(
    'Solicitante',
    55,
    assinaturaY + 10,
    {
      align: 'center',
    }
  );

  doc.text(
    `Data: ${dataSolicitacao}`,
    55,
    assinaturaY + 15,
    {
      align: 'center',
    }
  );

  // ----------------------------------------------------
  // ASSINATURA DIREITA
  // ----------------------------------------------------
  doc.line(
    120,
    assinaturaY,
    190,
    assinaturaY
  );

  doc.setFont(
    'helvetica',
    'bold'
  );

  doc.setFontSize(10);

  doc.text(
    'APROVAÇÃO / DEVOLUÇÃO',
    155,
    assinaturaY + 5,
    {
      align: 'center',
    }
  );

  doc.setFont(
    'helvetica',
    'normal'
  );

  doc.setFontSize(9);

  doc.text(
    'Assinatura Responsável',
    155,
    assinaturaY + 10,
    {
      align: 'center',
    }
  );

  doc.text(
    'Data: ___/___/______',
    155,
    assinaturaY + 15,
    {
      align: 'center',
    }
  );

  // ====================================================
  // RETORNA O PDF COMO BUFFER
  // ====================================================
  return Buffer.from(
    doc.output('arraybuffer')
  );
};

// ======================================================
// NOTIFICAÇÃO DO DISCORD
// ======================================================
async function enviarNotificacaoDiscord(
  fields,
  tableRows
) {
  const webhookUrl =
    process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(
      'Webhook do Discord não configurado. Pulando notificação.'
    );

    return;
  }

  const colorMap = {
    Baixa: 0x00ff00,
    Média: 0xffff00,
    Alta: 0xff0000,
  };

  const itensDescricao = tableRows
    .map(
      (row) =>
        `📦 **${row.tipo || ''}** - ${
          row.bem || ''
        } ${
          row.patrimonio
            ? `(Pat: ${row.patrimonio})`
            : ''
        }`
    )
    .join('\n');

  const payload = {
    content:
      '🏢 **Nova Solicitação de ATIVO FIXO**',

    embeds: [
      {
        title:
          'Detalhes da Movimentação de Ativo',

        color:
          colorMap[fields.urgencia] ||
          0x0099ff,

        fields: [
          {
            name: 'Solicitante',
            value:
              fields.nome ||
              'Não informado',
            inline: true,
          },

          {
            name: 'Setor',
            value:
              fields.setor ||
              'Não informado',
            inline: true,
          },

          {
            name: 'Urgência',
            value:
              fields.urgencia ||
              'Não informada',
            inline: true,
          },

          {
            name: 'Itens',
            value:
              itensDescricao ||
              'Nenhum item',
          },

          {
            name: 'Observações',
            value:
              fields.observacao ||
              'Nenhuma',
          },
        ],

        timestamp:
          new Date().toISOString(),

        footer: {
          text:
            'Sistema Maglog - Ativo Fixo',
        },
      },
    ],
  };

  try {
    const response = await fetch(
      webhookUrl,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify(
          payload
        ),
      }
    );

    if (response.ok) {
      console.log(
        'Notificação de Ativo Fixo enviada para o Discord com sucesso.'
      );
    } else {
      console.error(
        `Erro ao enviar notificação para o Discord: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error(
      'Erro Discord:',
      error
    );
  }
}

// ======================================================
// API
// ======================================================
export default async function handler(
  req,
  res
) {
  // ====================================================
  // VALIDAÇÃO DO MÉTODO
  // ====================================================
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({
        message:
          'Método não permitido',
      });
  }

  // ====================================================
  // FORMIDABLE
  // ====================================================
  const form = formidable({
    multiples: true,
  });

  try {
    // ==================================================
    // LEITURA DO FORMULÁRIO
    // ==================================================
    const { fields } =
      await new Promise(
        (resolve, reject) => {
          form.parse(
            req,
            (
              err,
              fields,
              files
            ) => {
              if (err) {
                reject(err);
                return;
              }

              resolve({
                fields,
                files,
              });
            }
          );
        }
      );

    const getVal = (value) =>
      Array.isArray(value)
        ? value[0]
        : value;

    // ==================================================
    // DADOS PRINCIPAIS
    // ==================================================
    const dados = {
      nome:
        getVal(fields.nome),

      setor:
        getVal(fields.setor),

      observacao:
        getVal(
          fields.observacao
        ),

      urgencia:
        getVal(
          fields.urgencia
        ),
    };

    // ==================================================
    // ITENS
    // ==================================================
    const tableRows = [];

    const count = parseInt(
      getVal(
        fields.row_count
      ) || '0',
      10
    );

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const bem = getVal(
        fields[`bem_${i}`]
      );

      if (bem) {
        tableRows.push({
          bem,

          patrimonio:
            getVal(
              fields[
                `patrimonio_${i}`
              ]
            ),

          tipo:
            getVal(
              fields[
                `tipo_${i}`
              ]
            ),
        });
      }
    }

    // ==================================================
    // GERAÇÃO DO PDF
    // ==================================================
    const pdfBuffer =
      generatePDFBuffer(
        dados,
        tableRows
      );

    // ==================================================
    // VALIDAÇÃO DAS VARIÁVEIS DA VERCEL
    // ==================================================
    if (
      !process.env.GMAIL_USER
    ) {
      throw new Error(
        'Variável GMAIL_USER não configurada na Vercel.'
      );
    }

    if (
      !process.env
        .GMAIL_APP_PASSWORD
    ) {
      throw new Error(
        'Variável GMAIL_APP_PASSWORD não configurada na Vercel.'
      );
    }

    if (
      !process.env.EMAIL_TO
    ) {
      throw new Error(
        'Variável EMAIL_TO não configurada na Vercel.'
      );
    }

    // ==================================================
    // NODEMAILER - GMAIL
    // ==================================================
    const transporter =
      nodemailer.createTransport({
        service: 'gmail',

        auth: {
          user:
            process.env
              .GMAIL_USER,

          pass:
            process.env
              .GMAIL_APP_PASSWORD,
        },
      });

    // ==================================================
    // NOME DO ARQUIVO
    // ==================================================
    const nomeArquivo =
      (
        dados.nome ||
        'Solicitante'
      )
        .trim()
        .replace(/\s+/g, '_');

    // ==================================================
    // CONFIGURAÇÃO DO E-MAIL
    // ==================================================
    const mailOptions = {
      from:
        `"Envios Maglog" <${process.env.GMAIL_USER}>`,

      to:
        process.env.EMAIL_TO,

      subject:
        `Solicitação Ativo Fixo - ${
          dados.setor ||
          'Setor não informado'
        }`,

      text: `
Solicitante: ${dados.nome || 'Não informado'}
Setor: ${dados.setor || 'Não informado'}
Urgência: ${dados.urgencia || 'Não informada'}

O PDF da solicitação segue em anexo.

E-mail enviado automaticamente pelo Sistema de Ativo Fixo Maglog.
      `.trim(),

      attachments: [
        {
          filename:
            `AtivoFixo_${nomeArquivo}.pdf`,

          content:
            pdfBuffer,

          contentType:
            'application/pdf',
        },
      ],
    };

    // ==================================================
    // ENVIO DO E-MAIL
    // ==================================================
    console.log(
      `Enviando solicitação de Ativo Fixo para ${process.env.EMAIL_TO}...`
    );

    const info =
      await transporter.sendMail(
        mailOptions
      );

    console.log(
      'E-mail de Ativo Fixo enviado com sucesso:',
      info.messageId
    );

    // ==================================================
    // DISCORD
    // ==================================================
    await enviarNotificacaoDiscord(
      dados,
      tableRows
    );

    // ==================================================
    // RETORNO
    // ==================================================
    return res
      .status(200)
      .json({
        message:
          'Solicitação enviada e PDF gerado!',
      });
  } catch (error) {
    console.error(
      'Erro geral:',
      error
    );

    return res
      .status(500)
      .json({
        message:
          error.message ||
          'Erro interno.',
      });
  }
}
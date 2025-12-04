import nodemailer from 'nodemailer';
import formidable from 'formidable';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Função que gera o Buffer do PDF usando jsPDF
// Função corrigida para usar autoTable como função direta
const generatePDFBuffer = (fields, tableRows) => {
    const doc = new jsPDF();
    const dataSolicitacao = new Date().toLocaleDateString('pt-BR');

    // --- CABEÇALHO ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("SOLICITAÇÃO DE ATIVO FIXO", 105, 20, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25); 

    // --- DADOS DO SOLICITANTE ---
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    let yPos = 40; 
    
    doc.text(`Solicitante: ${fields.nome}`, 20, yPos);
    yPos += 8;
    doc.text(`Setor: ${fields.setor}`, 20, yPos);
    yPos += 8;
    doc.text(`Data da Solicitação: ${dataSolicitacao}`, 20, yPos);
    
    // --- TABELA DE ITENS ---
    const bodyData = tableRows.map(row => [
        row.bem,
        row.patrimonio || '---',
        row.tipo,
        // Nova coluna VAZIA para o Setor a ser preenchido manualmente
        '' 
    ]);

    // AQUI ESTÁ A CORREÇÃO PRINCIPAL:
    // Em vez de doc.autoTable, usamos autoTable(doc, options)
    autoTable(doc, {
        startY: yPos + 10,
        // Novo cabeçalho com a coluna 'SETOR'
        head: [['BEM (Descrição)', 'PATRIMÔNIO', 'TIPO', 'SETOR']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: 20, lineColor: 0 },
        styles: { fontSize: 10, cellPadding: 3 },
    });

    // Pega a posição onde a tabela terminou
    let finalY = doc.lastAutoTable.finalY + 15;

    // --- OBSERVAÇÕES ---
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 20, finalY);
    finalY += 7;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const obsText = doc.splitTextToSize(fields.observacao || "Sem observações.", 170);
    doc.text(obsText, 20, finalY);
    
    finalY += (obsText.length * 5) + 10;

    // --- URGÊNCIA ---
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`NÍVEL DE URGÊNCIA: ${fields.urgencia.toUpperCase()}`, 20, finalY);

    // --- ASSINATURAS ---
    if (finalY > 240) {
        doc.addPage();
        finalY = 40;
    } else {
        finalY += 40; 
    }

    const pageHeight = doc.internal.pageSize.height;
    const assinaturaY = finalY > (pageHeight - 40) ? pageHeight - 40 : finalY;

    // Assinatura Esquerda 
    doc.setLineWidth(0.2);
    doc.line(20, assinaturaY, 90, assinaturaY); 
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(fields.nome.toUpperCase(), 55, assinaturaY + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Solicitante", 55, assinaturaY + 10, { align: "center" });
    doc.text(`Data: ${dataSolicitacao}`, 55, assinaturaY + 15, { align: "center" });

    // Assinatura Direita 
    doc.line(120, assinaturaY, 190, assinaturaY); 
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("APROVAÇÃO / DEVOLUÇÃO", 155, assinaturaY + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Assinatura Responsável", 155, assinaturaY + 10, { align: "center" });
    doc.text("Data: ___/___/______", 155, assinaturaY + 15, { align: "center" });

    return Buffer.from(doc.output('arraybuffer'));
};

async function enviarNotificacaoDiscord(fields, tableRows) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const colorMap = {
      'Baixa': 0x00FF00,
      'Média': 0xFFFF00,
      'Alta': 0xFF0000
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
    
    const dados = {
        nome: getVal(fields.nome),
        setor: getVal(fields.setor),
        observacao: getVal(fields.observacao),
        urgencia: getVal(fields.urgencia),
    };

    const tableRows = [];
    const count = parseInt(getVal(fields.row_count) || '0');
    
    for (let i = 0; i < count; i++) {
        const bem = getVal(fields[`bem_${i}`]);
        if (bem) {
            tableRows.push({
                bem: bem,
                patrimonio: getVal(fields[`patrimonio_${i}`]),
                tipo: getVal(fields[`tipo_${i}`])
            });
        }
    }

    // --- AQUI MUDA: Chamamos a nova função generatePDFBuffer ---
    const pdfBuffer = generatePDFBuffer(dados, tableRows);

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
      text: `Solicitante: ${dados.nome}\nUrgência: ${dados.urgencia}\n\nO PDF da solicitação segue em anexo.`,
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

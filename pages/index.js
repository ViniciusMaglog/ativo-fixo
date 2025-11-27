import { useState, useEffect } from 'react';
import Image from 'next/image';
import Head from 'next/head'; 

export default function AtivoFixoPage() {
  const [status, setStatus] = useState({ submitting: false, success: false, error: '' });
  const [dataAtual, setDataAtual] = useState('');

  // Estado inicial do formulário
  const [formData, setFormData] = useState({
    nome: '',
    setor: '',
    observacao: '',
    urgencia: 'Baixa',
  });

  // Estado da tabela dinâmica
  const [rows, setRows] = useState([
    { bem: '', patrimonio: '', tipo: '' } // Tipo será: RAF, TAF ou BAF
  ]);

  useEffect(() => {
    // Definir data fixa ao carregar a página
    setDataAtual(new Date().toLocaleDateString('pt-BR'));
  }, []);

  // Manipulação dos dados simples
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Manipulação da tabela dinâmica
  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    
    // Limpar patrimonio se mudar para RAF (opcional, mas boa prática de UX)
    if (field === 'tipo' && value === 'RAF') {
        newRows[index].patrimonio = ''; 
    }
    
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, { bem: '', patrimonio: '', tipo: '' }]);
  };

  const removeRow = (index) => {
    if (rows.length > 1) {
      const newRows = rows.filter((_, i) => i !== index);
      setRows(newRows);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ submitting: true, success: false, error: '' });

    // Validação Personalizada
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.tipo) {
            setStatus({ submitting: false, success: false, error: `Selecione o tipo (RAF, TAF, BAF) na linha ${i + 1}.` });
            return;
        }
        if ((row.tipo === 'TAF' || row.tipo === 'BAF') && !row.patrimonio.trim()) {
            setStatus({ submitting: false, success: false, error: `O campo PATRIMÔNIO é obrigatório para TAF ou BAF na linha ${i + 1}.` });
            return;
        }
        if (!row.bem.trim()) {
            setStatus({ submitting: false, success: false, error: `Descreva o BEM na linha ${i + 1}.` });
            return;
        }
    }

    const payload = new FormData();
    payload.append('nome', formData.nome);
    payload.append('setor', formData.setor);
    payload.append('observacao', formData.observacao);
    payload.append('urgencia', formData.urgencia);
    
    // Adiciona linhas da tabela
    payload.append('row_count', rows.length);
    rows.forEach((row, index) => {
        payload.append(`bem_${index}`, row.bem);
        payload.append(`patrimonio_${index}`, row.patrimonio);
        payload.append(`tipo_${index}`, row.tipo);
    });

    try {
      const response = await fetch('/api/ativo-fixo', { method: 'POST', body: payload });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message);

      setStatus({ submitting: false, success: true, error: '' });
      // Resetar form (opcional)
      setFormData({ nome: '', setor: '', observacao: '', urgencia: 'Baixa' });
      setRows([{ bem: '', patrimonio: '', tipo: '' }]);
    } catch (error) {
      setStatus({ submitting: false, success: false, error: error.message });
    }
  };

  const inputStyles = "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400";
  const labelStyles = "block font-medium mb-1 text-gray-700 dark:text-gray-200 text-sm";

  return (
    <div className="min-h-screen bg-cyan-900 dark:bg-gray-900 flex items-center justify-center p-4">
        <Head>
            <title>Ativo Fixo - Maglog</title>
        </Head>
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-4xl">
        <div className="flex justify-center mb-4">
             {/* Certifique-se de que a imagem existe em public/logo.png */}
            <Image src="/logo.png" alt="Logo Maglog" width={150} height={50} priority />
        </div>
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100 uppercase">Solicitação de Ativo Fixo</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Dados Iniciais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-md border-gray-300 dark:border-gray-600">
             <div>
                <label className={labelStyles}>Nome Solicitante</label>
                <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} required className={inputStyles} />
             </div>
             <div>
                <label className={labelStyles}>Setor</label>
                <input type="text" name="setor" value={formData.setor} onChange={handleInputChange} required className={inputStyles} />
             </div>
             <div>
                <label className={labelStyles}>Data (Automática)</label>
                <input type="text" value={dataAtual} disabled className={`${inputStyles} bg-gray-200 cursor-not-allowed opacity-75`} />
             </div>
          </div>

          {/* Tabela Dinâmica */}
          <div className="border border-gray-300 dark:border-gray-600 p-4 rounded-md overflow-x-auto">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2">Itens do Ativo</h3>
            <table className="w-full min-w-[600px]">
                <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-300 text-sm">
                        <th className="pb-2 w-5/12">BEM (Descrição)</th>
                        <th className="pb-2 w-3/12">TIPO (Seleção)</th>
                        <th className="pb-2 w-3/12">PATRIMÔNIO</th>
                        <th className="pb-2 w-1/12"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0 align-top">
                            <td className="pr-2 py-2">
                                <input 
                                    type="text" 
                                    placeholder="Nome do Item"
                                    value={row.bem}
                                    onChange={(e) => handleRowChange(index, 'bem', e.target.value)}
                                    className={inputStyles}
                                />
                            </td>
                            <td className="pr-2 py-2">
                                <div className="flex flex-col space-y-1 text-sm text-gray-800 dark:text-gray-200">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name={`tipo_${index}`} checked={row.tipo === 'RAF'} onChange={() => handleRowChange(index, 'tipo', 'RAF')} className="text-cyan-600 focus:ring-cyan-500"/>
                                        <span>RAF (Requisição)</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name={`tipo_${index}`} checked={row.tipo === 'TAF'} onChange={() => handleRowChange(index, 'tipo', 'TAF')} className="text-cyan-600 focus:ring-cyan-500"/>
                                        <span>TAF (Transferência)</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name={`tipo_${index}`} checked={row.tipo === 'BAF'} onChange={() => handleRowChange(index, 'tipo', 'BAF')} className="text-cyan-600 focus:ring-cyan-500"/>
                                        <span>BAF (Baixa)</span>
                                    </label>
                                </div>
                            </td>
                            <td className="pr-2 py-2">
                                <input 
                                    type="text" 
                                    placeholder={row.tipo === 'RAF' ? 'Opcional' : 'Obrigatório'}
                                    value={row.patrimonio}
                                    onChange={(e) => handleRowChange(index, 'patrimonio', e.target.value)}
                                    className={`${inputStyles} ${row.tipo === 'RAF' ? '' : 'border-l-4 border-l-orange-500'}`} 
                                    // Borda laranja indica obrigatoriedade visual
                                />
                            </td>
                            <td className="py-2 text-center">
                                {rows.length > 1 && (
                                    <button type="button" onClick={() => removeRow(index)} className="text-red-500 hover:text-red-700 font-bold text-xl">&times;</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button type="button" onClick={addRow} className="mt-3 text-cyan-600 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1">
                <span className="text-xl">+</span> Adicionar outro item
            </button>
          </div>

          {/* Observações */}
          <div>
            <label className={labelStyles}>Observações</label>
            <textarea 
                name="observacao" 
                rows="3" 
                value={formData.observacao}
                onChange={handleInputChange}
                className={inputStyles}
                placeholder="Detalhes adicionais sobre a solicitação..."
            ></textarea>
          </div>

          {/* Urgência e Assinatura Visual */}
          {/* Urgência (Aviso visual removido) */}
          <div>
              <label className={labelStyles}>Nível de Urgência</label>
              <select name="urgencia" value={formData.urgencia} onChange={handleInputChange} className={inputStyles}>
                  <option value="Baixa">Baixa (Normal)</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
              </select>
          </div>

          {/* Botão Enviar */}
          <div className="text-center pt-4">
             <button type="submit" disabled={status.submitting} className="w-full md:w-1/3 px-8 py-3 bg-cyan-600 text-white font-bold rounded-md hover:bg-cyan-700 disabled:bg-cyan-400 transition-colors shadow-md">
                {status.submitting ? 'Gerando PDF e Enviando...' : 'ENVIAR SOLICITAÇÃO'}
             </button>
          </div>

          {/* Feedback */}
          {status.success && (
            <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded text-center">
                Solicitação enviada! Verifique seu e-mail para o PDF.
            </div>
          )}
          {status.error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded text-center">
                Erro: {status.error}
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
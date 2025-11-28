import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';

export default function AtivoFixoPage() {
  const [status, setStatus] = useState({ submitting: false, success: false, error: '' });
  const [dataAtual, setDataAtual] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    setor: '',
    observacao: '',
    urgencia: 'Baixa',
  });

  const [rows, setRows] = useState([
    { bem: '', patrimonio: '', tipo: '' }
  ]);

  useEffect(() => {
    setDataAtual(new Date().toLocaleDateString('pt-BR'));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
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
      setFormData({ nome: '', setor: '', observacao: '', urgencia: 'Baixa' });
      setRows([{ bem: '', patrimonio: '', tipo: '' }]);
    } catch (error) {
      setStatus({ submitting: false, success: false, error: error.message });
    }
  };

  // ESTILOS PADRONIZADOS (Igual ao Financeiro)
  const labelStyles = "block font-bold text-gray-700 dark:text-gray-300 text-xs uppercase mb-1";
  
  // Input Geral (Mobile e Form)
  const inputStyles = "w-full px-3 py-3 border rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 dark:bg-gray-900 dark:border-gray-600 dark:text-white text-sm border-gray-300 placeholder-gray-400 dark:placeholder-gray-500";
  
  // Input de Tabela (Desktop - Altura fixa 40px)
  const tableInputStyles = "w-full h-10 px-2 border rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-transparent dark:text-white dark:border-gray-600 text-sm border-gray-300 placeholder-gray-400";

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-2 md:p-4 font-sans transition-colors duration-200">
        <Head><title>Ativo Fixo - Maglog</title></Head>
      
      <div className="w-full max-w-[95%] mx-auto bg-white dark:bg-gray-800 p-4 md:p-8 rounded-lg shadow-xl border-t-8 border-cyan-900 dark:border-cyan-600">
        
        {/* LOGO */}
        <div className="flex justify-center mb-4 md:mb-6">
            <Image src="/logo.png" alt="Logo Maglog" width={180} height={60} priority className="w-32 md:w-48 h-auto" />
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-center text-cyan-900 dark:text-cyan-400 mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-2 uppercase">
            Solicitação de Ativo Fixo
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Dados Iniciais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-300 dark:border-gray-600 p-4 rounded bg-gray-50 dark:bg-gray-700/30">
             <div><label className={labelStyles}>Nome Solicitante</label><input type="text" name="nome" value={formData.nome} onChange={handleInputChange} required className={inputStyles} /></div>
             <div><label className={labelStyles}>Setor</label><input type="text" name="setor" value={formData.setor} onChange={handleInputChange} required className={inputStyles} /></div>
             <div><label className={labelStyles}>Data</label><input type="text" value={dataAtual} disabled className={`${inputStyles} bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed`} /></div>
          </div>

          {/* --- TABELA DESKTOP --- */}
          <div className="hidden md:block overflow-x-auto border border-gray-300 dark:border-gray-600 rounded">
            <table className="w-full text-sm border-collapse min-w-[800px]">
                <thead className="bg-cyan-900 dark:bg-cyan-950 text-white">
                    <tr>
                        <th className="p-2 border border-cyan-800 text-left w-5/12">BEM (Descrição)</th>
                        <th className="p-2 border border-cyan-800 text-left w-3/12">TIPO</th>
                        <th className="p-2 border border-cyan-800 text-left w-3/12">PATRIMÔNIO</th>
                        <th className="p-2 border border-cyan-800 w-1/12 text-center">Excluir</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rows.map((row, index) => (
                        <tr key={index} className="bg-white dark:bg-gray-800 align-middle">
                            <td className="p-1 border dark:border-gray-600">
                                <input type="text" placeholder="Nome do Item" value={row.bem} onChange={(e) => handleRowChange(index, 'bem', e.target.value)} className={tableInputStyles} />
                            </td>
                            <td className="p-1 border dark:border-gray-600">
                                <div className="flex gap-4 items-center h-10 px-2">
                                    {['RAF', 'TAF', 'BAF'].map(type => (
                                        <label key={type} className="flex items-center space-x-1 cursor-pointer">
                                            <input type="radio" name={`tipo_${index}`} checked={row.tipo === type} onChange={() => handleRowChange(index, 'tipo', type)} className="text-cyan-600 focus:ring-cyan-500 h-4 w-4" />
                                            <span className="text-gray-700 dark:text-gray-300 font-bold text-xs">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </td>
                            <td className="p-1 border dark:border-gray-600">
                                <input 
                                    type="text" 
                                    placeholder={row.tipo === 'RAF' ? 'Opcional' : 'Obrigatório'}
                                    value={row.patrimonio}
                                    onChange={(e) => handleRowChange(index, 'patrimonio', e.target.value)}
                                    className={`${tableInputStyles} ${row.tipo && row.tipo !== 'RAF' ? 'border-orange-400 dark:border-orange-500' : ''}`} 
                                />
                            </td>
                            <td className="p-1 border dark:border-gray-600">
                                {rows.length > 1 && <button type="button" onClick={() => removeRow(index)} className="w-full h-10 flex items-center justify-center text-red-500 hover:text-red-700 font-bold">X</button>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* --- CARDS MOBILE --- */}
          <div className="block md:hidden space-y-4">
            <h3 className="font-bold text-cyan-900 dark:text-cyan-400 text-lg border-b border-gray-300 dark:border-gray-700 pb-2">Itens do Ativo</h3>
            {rows.map((row, index) => (
                <div key={index} className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 p-4 rounded shadow-sm">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
                        <span className="font-bold text-gray-600 dark:text-white">Item #{index + 1}</span>
                        {rows.length > 1 && <button type="button" onClick={() => removeRow(index)} className="text-red-500 font-bold border border-red-200 px-2 py-1 rounded">Excluir</button>}
                    </div>
                    <div className="space-y-3">
                        <div><label className={labelStyles}>Bem (Descrição)</label><input type="text" value={row.bem} onChange={(e) => handleRowChange(index, 'bem', e.target.value)} className={inputStyles} /></div>
                        
                        <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded border dark:border-gray-600">
                            <label className={labelStyles}>Tipo</label>
                            <div className="flex gap-4 mt-2">
                                {['RAF', 'TAF', 'BAF'].map(type => (
                                    <label key={type} className="flex items-center space-x-2 cursor-pointer p-2 bg-white dark:bg-gray-900 rounded border dark:border-gray-600 flex-1 justify-center">
                                        <input type="radio" name={`tipo_m_${index}`} checked={row.tipo === type} onChange={() => handleRowChange(index, 'tipo', type)} className="text-cyan-600 h-4 w-4" />
                                        <span className="text-gray-800 dark:text-white font-bold">{type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className={labelStyles}>Patrimônio {row.tipo && row.tipo !== 'RAF' && <span className="text-orange-500">(Obrigatório)</span>}</label>
                            <input type="text" value={row.patrimonio} onChange={(e) => handleRowChange(index, 'patrimonio', e.target.value)} className={`${inputStyles} ${row.tipo && row.tipo !== 'RAF' ? 'border-orange-400' : ''}`} />
                        </div>
                    </div>
                </div>
            ))}
          </div>

          <button type="button" onClick={addRow} className="w-full md:w-auto mt-2 text-sm bg-cyan-600 text-white px-6 py-3 rounded hover:bg-cyan-700 transition-colors font-bold">+ Adicionar Item</button>

          {/* Observações */}
          <div>
            <label className={labelStyles}>Observações</label>
            <textarea name="observacao" rows="3" value={formData.observacao} onChange={handleInputChange} className={inputStyles} placeholder="Detalhes adicionais..."></textarea>
          </div>

          {/* Urgência */}
          <div className="w-full md:w-1/3">
              <label className={labelStyles}>Nível de Urgência</label>
              <select name="urgencia" value={formData.urgencia} onChange={handleInputChange} className={`${inputStyles} dark:bg-gray-900`}>
                  <option value="Baixa">Baixa (Normal)</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
              </select>
          </div>

          <div className="text-center pt-4 pb-8">
             <button type="submit" disabled={status.submitting} className="w-full md:w-1/2 px-8 py-4 bg-cyan-900 dark:bg-cyan-700 text-white font-bold rounded shadow hover:bg-cyan-800 dark:hover:bg-cyan-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors text-lg">
                {status.submitting ? 'ENVIANDO...' : 'ENVIAR SOLICITAÇÃO'}
             </button>
          </div>

          {status.success && <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded text-center font-bold mb-8">Solicitação enviada! Verifique seu e-mail.</div>}
          {status.error && <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded text-center font-bold mb-8">Erro: {status.error}</div>}

        </form>
      </div>
    </div>
  );
}
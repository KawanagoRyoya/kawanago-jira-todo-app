exports.createReport = (type, todos) => {
    const header = type === 'start'
      ? `始業報告 (${new Date().toLocaleDateString()})`  
      : `終業報告 (${new Date().toLocaleDateString()})`;
    const lines = todos.map(t => `- ${t.description} (期限: ${t.dueDate})`);
    return [header, ...lines].join('\n');
  };
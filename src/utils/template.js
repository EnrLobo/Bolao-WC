class SafeString {
  constructor(str) { this.str = str; }
  toString() { return this.str; }
}

export function escapeHtml(str) {
  if (str instanceof SafeString) return str.toString();
  if (typeof str === 'boolean' || str === null || str === undefined) return '';
  
  return String(str).replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));
}

export function html(strings, ...values) {
  const result = strings.reduce((acc, str, i) => {
    let val = values[i - 1];
    
    let formattedVal;
    // Se for uma lista (array), passamos a segurança em cada item e juntamos aqui dentro!
    if (Array.isArray(val)) {
      formattedVal = val.map(v => escapeHtml(v)).join('');
    } else {
      formattedVal = escapeHtml(val);
    }
    
    return acc + formattedVal + str;
  });
  return new SafeString(result);
}
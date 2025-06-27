// public/script.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('emailForm');
  const input = document.getElementById('emailInput');
  const messageDiv = document.getElementById('message');
  const resultsDiv = document.getElementById('results');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    resultsDiv.innerHTML = '';
    messageDiv.textContent = '';

    const raw = input.value.trim();
    if (!raw) {
      messageDiv.textContent = 'Please enter at least one email.';
      return;
    }
    // Split by comma
    const emails = raw.split(',').map(s => s.trim()).filter(s => s);
    if (emails.length === 0) {
      messageDiv.textContent = 'No valid emails found.';
      return;
    }

    messageDiv.textContent = 'Validating... (this may take several seconds if SMTP checks are performed)';
    try {
      const resp = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Server error');
      }
      const data = await resp.json();
      renderResults(data.results);
    } catch (err) {
      messageDiv.textContent = `Error: ${err.message}`;
    }
  });

  function renderResults(results) {
    messageDiv.textContent = '';
    if (!Array.isArray(results) || results.length === 0) {
      resultsDiv.textContent = 'No results.';
      return;
    }
    // Build a table
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Email', 'Status', 'Syntax', 'Domain', 'MX', 'SMTP', 'Disposable', 'Role-based', 'Time (ms)'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    results.forEach(r => {
      const tr = document.createElement('tr');
      // Email
      const tdEmail = document.createElement('td');
      tdEmail.textContent = r.email;
      tr.appendChild(tdEmail);
      // Status
      const tdStatus = document.createElement('td');
      tdStatus.textContent = r.isValid ? 'VALID' : 'INVALID';
      tdStatus.className = r.isValid ? 'valid' : 'invalid';
      tr.appendChild(tdStatus);
      // Checks: for each check, show passed message or failure
      ['syntax','domain','mx','smtp','disposable','roleBased'].forEach(key => {
        const td = document.createElement('td');
        const check = r.checks[key];
        if (!check) {
          td.textContent = '-';
        } else {
          td.textContent = check.message || (check.passed ? 'OK' : 'Fail');
          if (!check.passed) td.classList.add('invalid');
        }
        tr.appendChild(td);
      });
      // Time
      const tdTime = document.createElement('td');
      tdTime.textContent = r.executionTime != null ? r.executionTime : '-';
      tr.appendChild(tdTime);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    resultsDiv.innerHTML = '';
    resultsDiv.appendChild(table);
  }
});

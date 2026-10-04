let activeTabId = null;
let lastExtractedData = null;
const DEFAULT_BACKEND_URL = 'http://localhost:3000';

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const selectedRowCountBadge = document.getElementById('selected-row-count');
const columnsContainer = document.getElementById('columns-container');
const btnSelectAllCols = document.getElementById('btn-select-all-cols');
const btnClearCols = document.getElementById('btn-clear-cols');
const btnSelectAllRows = document.getElementById('btn-select-all-rows');
const btnDeselectAllRows = document.getElementById('btn-deselect-all-rows');
const btnExtract = document.getElementById('btn-extract');
const btnSendBackend = document.getElementById('btn-send-backend');
const packageTitleInput = document.getElementById('package-title-input');
const backendBarView = document.getElementById('backend-bar-view');
const backendBarEdit = document.getElementById('backend-bar-edit');
const backendUrlDisplay = document.getElementById('backend-url-display');
const backendUrlInput = document.getElementById('backend-url-input');
const btnSaveBackend = document.getElementById('btn-save-backend');
const btnResetBackend = document.getElementById('btn-reset-backend');
const btnCloseBackend = document.getElementById('btn-close-backend');
const alertBox = document.getElementById('alert-box');
const resultsSection = document.getElementById('results-section');
const resultCount = document.getElementById('result-count');
const jsonPreview = document.getElementById('json-preview');
const btnCopyJson = document.getElementById('btn-copy-json');
const btnDownloadJson = document.getElementById('btn-download-json');
const aiQueryInput = document.getElementById('ai-query-input');
const btnAskAi = document.getElementById('btn-ask-ai');
const aiStatusBadge = document.getElementById('ai-status-badge');
const aiResponseCard = document.getElementById('ai-response-card');
const aiResponseContent = document.getElementById('ai-response-content');
const btnCopyAi = document.getElementById('btn-copy-ai');
const aiChips = document.querySelectorAll('.ai-chip');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            showStatus('error', 'Active tab could not be detected.');
            return;
        }
        activeTabId = tab.id;

        loadSavedBackendUrl();
        fetchTableInfo();
        setupEventListeners();
    } catch (err) {
        showStatus('error', 'Initialization error: ' + err.message);
    }
});

function fetchTableInfo() {
    chrome.tabs.sendMessage(activeTabId, { action: 'GET_TABLE_INFO' }, (response) => {
        if (chrome.runtime.lastError || !response) {
            showStatus('error', 'No table found on this page or page is not ready.');
            columnsContainer.innerHTML = '<div class="loading-columns">Table not found.</div>';
            btnExtract.disabled = true;
            return;
        }

        if (!response.hasTable) {
            showStatus('error', 'Target table (#data-table) not found.');
            columnsContainer.innerHTML = '<div class="loading-columns">No target table.</div>';
            btnExtract.disabled = true;
            return;
        }

        showStatus('connected', 'Table connected');
        updateRowCount(response.selectedRowCount || 0);
        renderColumnCheckboxes(response.headers || []);
    });
}

function renderColumnCheckboxes(headers) {
    if (headers.length === 0) {
        columnsContainer.innerHTML = '<div class="loading-columns">No column headers found.</div>';
        return;
    }

    columnsContainer.innerHTML = '';

    headers.forEach((headerName, index) => {
        const itemLabel = document.createElement('label');
        itemLabel.className = 'column-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = headerName;
        checkbox.id = `col-check-${index}`;
        checkbox.checked = true;

        const span = document.createElement('span');
        span.textContent = headerName;

        itemLabel.appendChild(checkbox);
        itemLabel.appendChild(span);
        columnsContainer.appendChild(itemLabel);
    });
}

function setupEventListeners() {
    btnSelectAllCols.addEventListener('click', () => setAllColumnCheckboxes(true));
    btnClearCols.addEventListener('click', () => setAllColumnCheckboxes(false));
    btnSelectAllRows.addEventListener('click', () => togglePageRows(true));
    btnDeselectAllRows.addEventListener('click', () => togglePageRows(false));

    btnExtract.addEventListener('click', handleExtractOnly);
    btnSendBackend.addEventListener('click', handleSendBackend);

    if (backendBarView) backendBarView.addEventListener('click', openBackendEdit);
    if (btnCloseBackend) btnCloseBackend.addEventListener('click', closeBackendEdit);
    btnSaveBackend.addEventListener('click', handleSaveBackendUrl);
    btnResetBackend.addEventListener('click', handleResetBackendUrl);

    btnCopyJson.addEventListener('click', handleCopyJson);
    btnDownloadJson.addEventListener('click', handleDownloadJson);

    if (btnAskAi) btnAskAi.addEventListener('click', () => handleAskAi());
    if (aiQueryInput) {
        aiQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAskAi();
        });
    }
    if (btnCopyAi) btnCopyAi.addEventListener('click', handleCopyAiResponse);
    aiChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            if (aiQueryInput && prompt) {
                aiQueryInput.value = prompt;
                handleAskAi();
            }
        });
    });
}

function togglePageRows(shouldSelect) {
    chrome.tabs.sendMessage(activeTabId, {
        action: 'TOGGLE_ALL_SELECTION',
        select: shouldSelect
    }, (response) => {
        if (response && response.success) {
            updateRowCount(response.selectedRowCount);
            showAlert('success', shouldSelect ? 'All rows selected.' : 'Selection cleared.', 2000);
        }
    });
}

function getSelectedColumnNames() {
    const selectedColumns = [];
    const checkedBoxes = columnsContainer.querySelectorAll('input[type="checkbox"]:checked');
    checkedBoxes.forEach(cb => selectedColumns.push(cb.value));
    return selectedColumns;
}

function fetchExtractedDataFromPage() {
    return new Promise((resolve, reject) => {
        const selectedColumns = getSelectedColumnNames();
        if (selectedColumns.length === 0) {
            return reject(new Error('Please select at least one column to include.'));
        }

        chrome.tabs.sendMessage(activeTabId, {
            action: 'EXTRACT_DATA',
            selectedColumns: selectedColumns
        }, (response) => {
            if (chrome.runtime.lastError || !response) {
                return reject(new Error('Could not communicate with page. Please reload and try again.'));
            }
            if (!response.success) {
                return reject(new Error(response.error || 'Data extraction failed.'));
            }
            resolve(response.data);
        });
    });
}

// Action: Extract data & preview
async function handleExtractOnly() {
    clearAlert();
    btnExtract.disabled = true;
    btnExtract.innerHTML = '<span class="btn-icon">⏳</span><span>Extracting...</span>';

    try {
        const data = await fetchExtractedDataFromPage();
        lastExtractedData = data;
        displayResults(data);
        showAlert('success', `✓ ${data.length} rows extracted. You can copy or download.`, 3500);
    } catch (err) {
        showAlert('warning', err.message);
    } finally {
        btnExtract.disabled = false;
        btnExtract.innerHTML = '<span class="btn-icon">🔍</span><span>Extract Data</span>';
    }
}

// Action: Send package to backend
async function handleSendBackend() {
    clearAlert();

    const currentBackendUrl = backendUrlInput.value.trim() || DEFAULT_BACKEND_URL;
    try {
        validateBackendUrl(currentBackendUrl);
    } catch (e) {
        showAlert('warning', e.message);
        return;
    }

    btnSendBackend.disabled = true;
    btnSendBackend.innerHTML = '<span class="btn-icon">⏳</span><span>Sending...</span>';

    const coldStartTimer = setTimeout(() => {
        showAlert('info', '⏳ Waking up server, please wait (Render Free plan)...');
        btnSendBackend.innerHTML = '<span class="btn-icon">⚡</span><span>Waking Server...</span>';
    }, 4000);

    try {
        let dataToSend = lastExtractedData;
        if (!dataToSend || dataToSend.length === 0) {
            dataToSend = await fetchExtractedDataFromPage();
            lastExtractedData = dataToSend;
            displayResults(dataToSend);
        }

        const packageTitle = packageTitleInput ? packageTitleInput.value.trim() : '';
        const payload = {
            title: packageTitle,
            rows: dataToSend
        };

        chrome.runtime.sendMessage({
            action: 'SEND_TO_BACKEND',
            data: payload,
            backendUrl: currentBackendUrl
        }, (backendRes) => {
            clearTimeout(coldStartTimer);
            btnSendBackend.disabled = false;
            btnSendBackend.innerHTML = '<span class="btn-icon">🚀</span><span>Send to Backend</span>';

            if (backendRes && backendRes.success) {
                const pkgTitle = (backendRes.result && backendRes.result.title) ? `"${backendRes.result.title}"` : 'Package';
                showAlert('success', `✓ ${pkgTitle} (${dataToSend.length} rows) successfully saved to DB!`, 5000);
                if (packageTitleInput) {
                    packageTitleInput.value = '';
                }
            } else {
                const errMsg = (backendRes && backendRes.error) ? backendRes.error : 'Could not connect to server';
                showAlert('warning', `⚠️ Failed to send to backend: ${errMsg}. (Is server running?)`, 6000);
            }
        });

    } catch (err) {
        clearTimeout(coldStartTimer);
        btnSendBackend.disabled = false;
        btnSendBackend.innerHTML = '<span class="btn-icon">🚀</span><span>Send to Backend</span>';
        showAlert('warning', err.message);
    }
}

function validateBackendUrl(urlString) {
    const url = new URL(urlString);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (url.protocol === 'http:' && !isLocal) {
        throw new Error('Security Rule: HTTPS is required for remote servers. HTTP is only permitted for localhost.');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only http:// or https:// protocols are supported.');
    }

    return url;
}

// Backend URL Management
function openBackendEdit() {
    if (backendBarView && backendBarEdit) {
        backendBarView.classList.add('hidden');
        backendBarEdit.classList.remove('hidden');
        backendUrlInput.focus();
        backendUrlInput.select();
    }
}

function closeBackendEdit() {
    if (backendBarView && backendBarEdit) {
        backendBarEdit.classList.add('hidden');
        backendBarView.classList.remove('hidden');
    }
}

function loadSavedBackendUrl() {
    chrome.storage.local.get(['backendUrl'], (result) => {
        const url = (result && result.backendUrl) ? result.backendUrl : DEFAULT_BACKEND_URL;
        backendUrlInput.value = url;
        if (backendUrlDisplay) {
            backendUrlDisplay.textContent = url;
        }
    });
}

function handleSaveBackendUrl(e) {
    if (e) e.stopPropagation();
    const rawUrl = backendUrlInput.value.trim();
    try {
        validateBackendUrl(rawUrl);
        chrome.storage.local.set({ backendUrl: rawUrl }, () => {
            if (backendUrlDisplay) {
                backendUrlDisplay.textContent = rawUrl;
            }
            closeBackendEdit();
            showAlert('success', '✓ Backend address updated.', 2500);
        });
    } catch (err) {
        showAlert('warning', err.message);
    }
}

function handleResetBackendUrl(e) {
    if (e) e.stopPropagation();
    backendUrlInput.value = DEFAULT_BACKEND_URL;
    chrome.storage.local.remove(['backendUrl'], () => {
        if (backendUrlDisplay) {
            backendUrlDisplay.textContent = DEFAULT_BACKEND_URL;
        }
        closeBackendEdit();
        showAlert('success', '✓ Reset to default address.', 2500);
    });
}

function displayResults(data) {
    resultCount.textContent = data.length;
    jsonPreview.textContent = JSON.stringify(data, null, 2);
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

async function handleCopyJson() {
    if (!lastExtractedData) return;
    try {
        await navigator.clipboard.writeText(JSON.stringify(lastExtractedData, null, 2));
        const originalText = btnCopyJson.textContent;
        btnCopyJson.textContent = '✓ Copied!';
        setTimeout(() => {
            btnCopyJson.textContent = originalText;
        }, 1800);
    } catch (err) {
        showAlert('error', 'Failed to copy to clipboard.');
    }
}

function handleDownloadJson() {
    if (!lastExtractedData) return;
    try {
        const rawTitle = packageTitleInput ? packageTitleInput.value.trim() : '';
        const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_');
        const fileName = safeTitle ? `${safeTitle}.json` : `table_data_${Date.now()}.json`;

        const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lastExtractedData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", jsonString);
        downloadAnchor.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    } catch (err) {
        showAlert('error', 'Download failed.');
    }
}

let lastRawAiResponse = '';

// Safe Markdown & Table Formatter
function formatMarkdownToHtml(markdown) {
    if (!markdown) return '';

    // Convert raw <br> tags into newlines first
    let text = markdown.replace(/<br\s*\/?>/gi, '\n');

    // Escape HTML tags to prevent XSS
    text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Parse Markdown tables (| Col 1 | Col 2 |)
    const lines = text.split('\n');
    let inTable = false;
    let tableHtml = '';
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
            // Ignore separator line |---|---|
            if (/^\|[\s\-:|]+\|$/.test(line)) {
                continue;
            }
            if (!inTable) {
                inTable = true;
                tableHtml = '<table class="ai-table"><tbody>';
            }
            const cells = line.split('|').slice(1, -1);
            tableHtml += '<tr>';
            cells.forEach(cell => {
                tableHtml += `<td>${cell.trim()}</td>`;
            });
            tableHtml += '</tr>';
        } else {
            if (inTable) {
                inTable = false;
                tableHtml += '</tbody></table>';
                formattedLines.push(tableHtml);
                tableHtml = '';
            }
            formattedLines.push(lines[i]);
        }
    }
    if (inTable) {
        tableHtml += '</tbody></table>';
        formattedLines.push(tableHtml);
    }

    let html = formattedLines.join('\n');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4 class="ai-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="ai-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="ai-h2">$1</h2>');

    // Bold & Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet points
    html = html.replace(/^\s*[-•*]\s+(.*$)/gim, '<li class="ai-li">$1</li>');
    html = html.replace(/(<li class="ai-li">.*?<\/li>(\n|$))+/g, '<ul class="ai-ul">$&</ul>');

    // Horizontal Rule
    html = html.replace(/^---$/gim, '<hr class="ai-hr"/>');

    // Paragraph breaks and line breaks
    html = html.replace(/\n\n+/g, '<div class="ai-gap"></div>');
    html = html.replace(/\n/g, '<br/>');

    // Clean up unnecessary <br/> adjacent to block elements
    html = html.replace(/<br\/>(?=<\/?(table|tr|td|th|ul|li|h2|h3|h4|div|hr))/gi, '');
    html = html.replace(/(<\/(table|tr|td|th|ul|li|h2|h3|h4|div)>|<hr\/>)<br\/>/gi, '$1');

    return html;
}

// AI Assistant Action
async function handleAskAi() {
    clearAlert();
    const question = aiQueryInput ? aiQueryInput.value.trim() : '';
    if (!question) {
        showAlert('warning', 'Please enter a question or click one of the quick chips.', 3000);
        if (aiQueryInput) aiQueryInput.focus();
        return;
    }

    btnAskAi.disabled = true;
    btnAskAi.innerHTML = '<span class="ai-btn-text">⏳ Thinking...</span>';
    if (aiStatusBadge) {
        aiStatusBadge.textContent = 'Thinking...';
        aiStatusBadge.className = 'ai-status-badge thinking';
    }

    try {
        let contextRows = lastExtractedData;
        if (!contextRows || contextRows.length === 0) {
            contextRows = await fetchExtractedDataFromPage().catch(() => []);
            if (contextRows && contextRows.length > 0) {
                lastExtractedData = contextRows;
            }
        }

        const currentBackendUrl = (backendUrlInput && backendUrlInput.value.trim()) || DEFAULT_BACKEND_URL;

        chrome.runtime.sendMessage({
            action: 'ASK_AI',
            data: {
                question,
                context: contextRows || []
            },
            backendUrl: currentBackendUrl
        }, (res) => {
            btnAskAi.disabled = false;
            btnAskAi.innerHTML = '<span class="ai-btn-text">Ask AI</span>';

            if (res && res.success && res.result && res.result.answer) {
                lastRawAiResponse = res.result.answer;
                if (aiResponseContent && aiResponseCard) {
                    aiResponseContent.innerHTML = formatMarkdownToHtml(res.result.answer);
                    aiResponseCard.classList.remove('hidden');
                    aiResponseCard.scrollIntoView({ behavior: 'smooth' });
                }
                if (aiStatusBadge) {
                    aiStatusBadge.textContent = 'Ready';
                    aiStatusBadge.className = 'ai-status-badge';
                }
            } else {
                const errMsg = (res && res.error) ? res.error : 'Failed to connect to AI server.';
                showAlert('warning', `⚠️ AI Error: ${errMsg}`, 5000);
                if (aiStatusBadge) {
                    aiStatusBadge.textContent = 'Error';
                    aiStatusBadge.className = 'ai-status-badge';
                }
            }
        });

    } catch (err) {
        btnAskAi.disabled = false;
        btnAskAi.innerHTML = '<span class="ai-btn-text">Ask AI</span>';
        if (aiStatusBadge) {
            aiStatusBadge.textContent = 'Error';
            aiStatusBadge.className = 'ai-status-badge';
        }
        showAlert('warning', `AI Error: ${err.message}`, 4000);
    }
}

async function handleCopyAiResponse() {
    const textToCopy = lastRawAiResponse || (aiResponseContent ? aiResponseContent.innerText : '');
    if (!textToCopy) return;
    try {
        await navigator.clipboard.writeText(textToCopy);
        if (btnCopyAi) {
            const originalText = btnCopyAi.textContent;
            btnCopyAi.textContent = '✓ Copied!';
            setTimeout(() => {
                btnCopyAi.textContent = originalText;
            }, 1800);
        }
    } catch (err) {
        showAlert('error', 'Failed to copy AI response.');
    }
}

// UI Helpers
function showStatus(type, message) {
    statusDot.className = 'dot ' + type;
    statusText.textContent = message;
}

function updateRowCount(count) {
    selectedRowCountBadge.textContent = count;
}

function setAllColumnCheckboxes(checked) {
    const checkboxes = columnsContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = checked);
}

function showAlert(type, message, timeout = 0) {
    alertBox.className = `alert-box ${type}`;
    alertBox.textContent = message;
    alertBox.classList.remove('hidden');

    if (timeout > 0) {
        setTimeout(() => clearAlert(), timeout);
    }
}

function clearAlert() {
    alertBox.textContent = '';
    alertBox.className = 'alert-box hidden';
}

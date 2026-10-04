/**
 * Table Data Extractor - Background Service Worker
 * 
 * Forwards HTTP POST requests to the backend.
 * Enforces HTTPS for remote endpoints.
 */

const DEFAULT_BACKEND_URL = 'http://localhost:3000';

function validateBackendUrl(urlString) {
    const url = new URL(urlString);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (url.protocol === 'http:' && !isLocal) {
        throw new Error('Security Rule: HTTPS is required for remote servers. HTTP is only permitted for localhost.');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only http:// and https:// protocols are supported.');
    }

    return url;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SEND_TO_BACKEND') {
        const targetUrl = request.backendUrl || DEFAULT_BACKEND_URL;

        try {
            validateBackendUrl(targetUrl);
        } catch (err) {
            sendResponse({ success: false, error: err.message });
            return true;
        }

        fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request.data)
        })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Server error: HTTP ${response.status}`);
            }
            return response.json();
        })
        .then((result) => {
            sendResponse({ success: true, result });
        })
        .catch((error) => {
            sendResponse({ success: false, error: error.message });
        });

        return true;
    }

    if (request.action === 'ASK_AI') {
        const targetUrl = request.backendUrl || DEFAULT_BACKEND_URL;
        const endpoint = targetUrl.replace(/\/+$/, '') + '/api/ask-ai';

        try {
            validateBackendUrl(targetUrl);
        } catch (err) {
            sendResponse({ success: false, error: err.message });
            return true;
        }

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request.data)
        })
        .then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || `Server error: HTTP ${response.status}`);
            }
            return data;
        })
        .then((result) => {
            sendResponse({ success: true, result });
        })
        .catch((error) => {
            sendResponse({ success: false, error: error.message });
        });

        return true;
    }
});

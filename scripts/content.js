function getTableElement() {
    return document.getElementById('data-table');
}

function getTableHeaders() {
    const table = getTableElement();
    if (!table) return [];

    const thElements = table.querySelectorAll('#table-head th');
    const headers = [];

    thElements.forEach((th, index) => {
        const text = th.textContent.trim();
        if (index > 0 && text && text.toLowerCase() !== 'select') {
            headers.push({
                index: index,
                name: text
            });
        }
    });

    return headers;
}

function getSelectedRows() {
    const table = getTableElement();
    if (!table) return [];

    const rows = table.querySelectorAll('#table-body tr');
    const selectedRows = [];

    rows.forEach(row => {
        const checkbox = row.querySelector('input.row-checkbox, input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            selectedRows.push(row);
        }
    });

    return selectedRows;
}

function extractData(requestedColumnNames) {
    const table = getTableElement();
    if (!table) {
        return { success: false, error: 'Table not found on this page!' };
    }

    const availableHeaders = getTableHeaders();
    if (availableHeaders.length === 0) {
        return { success: false, error: 'Table headers not loaded or not found.' };
    }

    let targetColumns = availableHeaders;
    if (Array.isArray(requestedColumnNames) && requestedColumnNames.length > 0) {
        targetColumns = availableHeaders.filter(header => 
            requestedColumnNames.includes(header.name)
        );
    }

    if (targetColumns.length === 0) {
        return { success: false, error: 'No valid columns selected to include.' };
    }

    const selectedRows = getSelectedRows();
    if (selectedRows.length === 0) {
        return { success: false, error: 'Please select at least one row from the table.' };
    }

    const extractedRecords = [];

    selectedRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const record = {};

        targetColumns.forEach(col => {
            if (cells[col.index]) {
                const cellText = cells[col.index].textContent.trim().replace(/\s+/g, ' ');
                record[col.name] = cellText;
            } else {
                record[col.name] = '';
            }
        });

        extractedRecords.push(record);
    });

    return {
        success: true,
        totalSelectedRows: selectedRows.length,
        selectedColumnsCount: targetColumns.length,
        data: extractedRecords
    };
}

function toggleAllRowsSelection(shouldSelect) {
    const table = getTableElement();
    if (!table) return 0;

    const rows = table.querySelectorAll('#table-body tr');
    let count = 0;

    rows.forEach(row => {
        const isVisible = (row.style.display !== 'none' && row.offsetParent !== null);
        if (!shouldSelect || isVisible) {
            const checkbox = row.querySelector('input.row-checkbox, input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = shouldSelect;
                count++;
            }
        }
    });

    return count;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'GET_TABLE_INFO': {
            const headers = getTableHeaders();
            const selectedRows = getSelectedRows();
            sendResponse({
                hasTable: !!getTableElement(),
                headers: headers.map(h => h.name),
                selectedRowCount: selectedRows.length
            });
            break;
        }

        case 'EXTRACT_DATA': {
            const result = extractData(request.selectedColumns);
            sendResponse(result);
            break;
        }

        case 'TOGGLE_ALL_SELECTION': {
            const affectedCount = toggleAllRowsSelection(request.select);
            const selectedRows = getSelectedRows();
            sendResponse({
                success: true,
                affectedCount: affectedCount,
                selectedRowCount: selectedRows.length
            });
            break;
        }

        default:
            sendResponse({ success: false, error: 'Unknown action request.' });
    }

    return true;
});

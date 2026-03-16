document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusContainer = document.getElementById('status-container');
    const resultContainer = document.getElementById('result-container');
    const statusText = document.getElementById('status-text');
    const fileInfo = document.getElementById('file-info');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');

    let processedCsvData = null;
    let originalFileName = '';

    const FIXED_HEADERS = [
        'log_time', 'uId', 'username', 'socialType', 'featureLabel', 
        'abTestCampaign', 'platform', 'country', 'group', 'actionId', 
        'gold', 'g', 'goldChange', 'gChange'
    ];

    // Drag & Drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.zip')) {
            handleFile(file);
        } else {
            alert('Vui lòng chỉ tải lên file .zip');
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    resetBtn.addEventListener('click', () => {
        resultContainer.classList.add('hidden');
        dropZone.classList.remove('hidden');
        fileInput.value = '';
    });

    async function handleFile(file) {
        originalFileName = file.name.replace('.zip', '');
        showStatus('Đang mở file ZIP...');
        
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(file);
            
            // Find .log file
            const logFileName = Object.keys(contents.files).find(name => name.endsWith('.log'));
            
            if (!logFileName) {
                throw new Error('Không tìm thấy file .log trong file ZIP.');
            }

            showStatus('Đang đọc file log...');
            const logText = await contents.files[logFileName].async('text');
            
            showStatus('Đang trích xuất dữ liệu...');
            const result = processLogData(logText);
            
            if (result.rows.length === 0) {
                throw new Error('Không tìm thấy dữ liệu MetricLog phù hợp.');
            }

            processedCsvData = result.header + '\n' + result.rows.join('\n');
            
            showResult(result.rows.length);
        } catch (error) {
            alert('Lỗi: ' + error.message);
            resetBtn.click();
        }
    }

    function processLogData(text) {
        const lines = text.split(/\r?\n/);
        const allDataFields = [];
        const pattern = 'MetricLog ---  log: ';
        let maxFields = FIXED_HEADERS.length;

        lines.forEach(line => {
            if (line.includes(pattern)) {
                const parts = line.split(pattern);
                if (parts.length > 1) {
                    const rawData = parts[1].trim();
                    const fields = rawData.split('|');
                    allDataFields.push(fields);
                    if (fields.length > maxFields) {
                        maxFields = fields.length;
                    }
                }
            }
        });

        // Generate Header
        const headers = [...FIXED_HEADERS];
        for (let i = 1; i <= (maxFields - FIXED_HEADERS.length); i++) {
            headers.push(`extra_${i}`);
        }

        // Process rows and pad if necessary
        const rows = allDataFields.map(fields => {
            // Pad fields to maxFields
            const paddedFields = [...fields];
            while (paddedFields.length < maxFields) {
                paddedFields.push('');
            }

            return paddedFields.map(field => {
                if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            }).join(',');
        });

        return {
            header: headers.join(','),
            rows: rows
        };
    }

    function showStatus(text) {
        dropZone.classList.add('hidden');
        resultContainer.classList.add('hidden');
        statusContainer.classList.remove('hidden');
        statusText.innerText = text;
    }

    function showResult(rowCount) {
        statusContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        fileInfo.innerText = `Đã tìm thấy ${rowCount} bản ghi metric.`;
    }

    downloadBtn.addEventListener('click', () => {
        if (!processedCsvData) return;

        const timestamp = new Date().getTime();
        const blob = new Blob([processedCsvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `metric_log_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});

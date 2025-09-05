let csvData = [];
let filteredData = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';

function analyzeData() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a CSV file first!');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const csvData = e.target.result;
        processCSV(csvData);
    };
    reader.readAsText(file);
}

function processCSV(csvData) {
    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').replace(/\uFEFF/g, ''));
    
    // Find column indices
    const supervisorNameIndex = headers.indexOf('Supervisor Name');
    const supervisorIDIndex = headers.indexOf('Supervisor ID');
    const dateIndex = headers.indexOf('Date');
    const timeIndex = headers.indexOf('Time');
    const wardIndex = headers.indexOf('Ward Name');
    const totalAmountIndex = headers.indexOf('Amount Collected'); // Corrected header for total amount
    
    console.log('Headers found:', headers);
    console.log('Indices:', {
        supervisorNameIndex,
        supervisorIDIndex,
        dateIndex,
        timeIndex,
        wardIndex
    });
    
    if (supervisorNameIndex === -1 || supervisorIDIndex === -1 || dateIndex === -1 || timeIndex === -1) {
        alert('Required columns not found in CSV file. Found headers: ' + headers.join(', '));
        return;
    }

    const supervisorData = {};
    const wardData = {};

    // Process each row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = parseCSVLine(line);
        if (columns.length <= Math.max(supervisorNameIndex, supervisorIDIndex, dateIndex, timeIndex)) continue;

        const supervisorName = columns[supervisorNameIndex].replace(/"/g, '');
        const supervisorID = columns[supervisorIDIndex].replace(/"/g, '');
        const date = columns[dateIndex].replace(/"/g, '');
        const time = columns[timeIndex].replace(/"/g, '');
        const wardName = wardIndex !== -1 ? (columns[wardIndex]?.replace(/"/g, '') || 'Unknown') : 'Unknown';
        const rawTotalAmount = columns[totalAmountIndex]?.replace(/"/g, '') || '0';
        // Remove any characters that are not digits or a decimal point
        const cleanedTotalAmount = rawTotalAmount.replace(/[^0-9.]/g, '');
        const totalAmount = totalAmountIndex !== -1 ? parseFloat(cleanedTotalAmount) : 0;


        if (!supervisorName || !date || !time) continue;

        const key = `${supervisorName}|${supervisorID}`;
        // Parse DD/MM/YYYY format to YYYY-MM-DD for proper Date parsing
        const [day, month, year] = date.split('/');
        const formattedDate = `${year}-${month}-${day}`;
        const dateTime = new Date(`${formattedDate} ${time}`);

        // Process supervisor data
        if (!supervisorData[key]) {
            supervisorData[key] = {
                supervisorName: supervisorName,
                supervisorID: supervisorID,
                firstDate: date,
                firstTime: time,
                lastDate: date,
                lastTime: time,
                firstDateTime: dateTime,
                lastDateTime: dateTime,
                count: 1,
                totalAmount: totalAmount
            };
        } else {
            supervisorData[key].count++;
            
            if (dateTime < supervisorData[key].firstDateTime) {
                supervisorData[key].firstDate = date;
                supervisorData[key].firstTime = time;
                supervisorData[key].firstDateTime = dateTime;
            }
            
            if (dateTime > supervisorData[key].lastDateTime) {
                supervisorData[key].lastDate = date;
                supervisorData[key].lastTime = time;
                supervisorData[key].lastDateTime = dateTime;
            }
            supervisorData[key].totalAmount += totalAmount;
        }

        // Process ward data
        if (!wardData[key]) wardData[key] = {};
        if (!wardData[key][wardName]) wardData[key][wardName] = { count: 0, totalAmount: 0 };
        wardData[key][wardName].count++;
        wardData[key][wardName].totalAmount += totalAmount;
    }

    // Add ward information to supervisor data
    for (const key in supervisorData) {
        supervisorData[key].wards = wardData[key] || {};
        supervisorData[key].wardList = Object.keys(supervisorData[key].wards).join(', ');
    }

    displayResults(supervisorData);
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    const resultsBody = document.getElementById('resultsBody');
    
    resultsBody.innerHTML = '';
    
    const sortedData = Object.values(data).sort((a, b) => 
        a.supervisorName.localeCompare(b.supervisorName)
    );
    
    // Calculate summary statistics
    const totalSupervisors = sortedData.length;
    const totalTransactions = sortedData.reduce((sum, item) => sum + item.count, 0);
    
    // Find date range
    let minDate = new Date('2999-12-31');
    let maxDate = new Date('1900-01-01');
    sortedData.forEach(item => {
        if (item.firstDateTime < minDate) minDate = item.firstDateTime;
        if (item.lastDateTime > maxDate) maxDate = item.lastDateTime;
    });
    
    // Find most active supervisor
    const mostActive = sortedData.reduce((max, item) => 
        item.count > max.count ? item : max
    );

    // Calculate total amount for all supervisors
    const overallTotalAmount = sortedData.reduce((sum, item) => sum + item.totalAmount, 0);
    
    // Calculate working hours for each supervisor
    sortedData.forEach(item => {
        const diffMs = item.lastDateTime - item.firstDateTime;
        const diffHours = Math.round(diffMs / (1000 * 60 * 60) * 100) / 100;
        item.workingHours = diffHours;
    });
    
    // Update summary cards
    document.getElementById('totalSupervisors').textContent = totalSupervisors;
    document.getElementById('totalTransactions').textContent = totalTransactions;
    document.getElementById('dateRange').textContent = 
        `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;
    document.getElementById('mostActiveSupervisor').textContent = 
        `${mostActive.supervisorName} (${mostActive.count} slips)`;
    document.getElementById('overallTotalAmount').textContent = overallTotalAmount.toFixed(2);
    
    // Update table
    let serialNumber = 1;
    sortedData.forEach(item => {
        const row = document.createElement('tr');
        row.insertCell().textContent = serialNumber++;
        row.insertCell().textContent = item.supervisorName;
        row.insertCell().textContent = item.supervisorID;
        row.insertCell().textContent = item.firstDate;
        row.insertCell().textContent = item.firstTime;
        row.insertCell().textContent = item.lastDate;
        row.insertCell().textContent = item.lastTime;
        row.insertCell().textContent = item.count;
        row.insertCell().textContent = item.workingHours.toFixed(2);
        row.insertCell().textContent = item.wardList;
        row.insertCell().textContent = (item.count / Object.keys(item.wards || {}).length).toFixed(2); // Slips per ward
        row.insertCell().textContent = item.totalAmount.toFixed(2); // Total amount
        row.insertCell().textContent = item.firstDate;
        row.insertCell().textContent = item.firstTime;
        row.insertCell().textContent = item.lastDate;
        row.insertCell().textContent = item.lastTime;
        row.insertCell().textContent = item.count;
        row.insertCell().textContent = item.workingHours.toFixed(2);
        row.insertCell().textContent = item.wardList;
        row.insertCell().textContent = (item.count / Object.keys(item.wards || {}).length).toFixed(2); // Slips per ward
        row.insertCell().textContent = item.totalAmount.toFixed(2); // Total amount

        const wardDetails = Object.entries(item.wards || {})
            .map(([ward, data]) => `Ward: ${ward} | Slips: ${data.count} | Amount: ${data.totalAmount.toFixed(2)}`)
            .join('<br>');
            
        row.innerHTML = `
            <td>${item.supervisorName}</td>
            <td>${item.supervisorID}</td>
            <td>${item.firstDate}</td>
            <td>${item.firstTime}</td>
            <td>${item.lastDate}</td>
            <td>${item.lastTime}</td>
            <td>${item.count}</td>
            <td>${item.workingHours} hrs</td>
            <td>${item.wardList || ''}</td>
            <td>${wardDetails}</td>
            <td>${item.totalAmount.toFixed(2)}</td>
        `;
        resultsBody.appendChild(row);
    });
    
    resultsDiv.style.display = 'block';

    // Add event listeners for sorting
    const headers = document.querySelectorAll('#resultsTable th');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');
            if (column) {
                sortTable(column);
            }
        });
    });
}

function sortTable(column) {
    const tableBody = document.getElementById('resultsBody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));

    const isNumeric = ['Total Slips', 'Working Hours'].includes(column);
    const isDate = ['First Slip Date', 'Last Slip Date'].includes(column);
    const isTime = ['First Slip Time', 'Last Slip Time'].includes(column);

    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    rows.sort((a, b) => {
        const aText = a.querySelector(`td:nth-child(${getColumnIndex(column)})`).textContent;
        const bText = b.querySelector(`td:nth-child(${getColumnIndex(column)})`).textContent;

        let valA = aText;
        let valB = bText;

        if (isNumeric) {
            valA = parseFloat(aText);
            valB = parseFloat(bText);
        } else if (isDate) {
            const [dayA, monthA, yearA] = aText.split('/');
            const [dayB, monthB, yearB] = bText.split('/');
            valA = new Date(`${yearA}-${monthA}-${dayA}`);
            valB = new Date(`${yearB}-${monthB}-${dayB}`);
        } else if (isTime) {
            valA = new Date(`2000-01-01T${aText}`); // Use a dummy date for time comparison
            valB = new Date(`2000-01-01T${bText}`);
        }

        if (valA < valB) {
            return currentSortDirection === 'asc' ? -1 : 1;
        } else if (valA > valB) {
            return currentSortDirection === 'asc' ? 1 : -1;
        } else {
            return 0;
        }
    });

    rows.forEach(row => tableBody.appendChild(row));

    // Update sort indicators (optional, but good for UX)
    document.querySelectorAll('#resultsTable th').forEach(th => {
        th.classList.remove('asc', 'desc');
    });
    const activeHeader = document.querySelector(`#resultsTable th[data-column="${column}"]`);
    if (activeHeader) {
        activeHeader.classList.add(currentSortDirection);
    }
}

function getColumnIndex(columnName) {
    const headers = Array.from(document.querySelectorAll('#resultsTable th'));
    const headerText = headers.map(th => th.textContent.trim());
    return headerText.indexOf(columnName) + 1;
}

function filterData() {
    const supervisorFilter = document.getElementById('supervisorFilter').value.toLowerCase();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    filteredData = csvData.filter(row => {
        const matchesSupervisor = !supervisorFilter || 
            row['Supervisor Name'].toLowerCase().includes(supervisorFilter) ||
            row['Supervisor ID'].toString().includes(supervisorFilter);
        
        const rowDate = new Date(row.Date);
        const matchesStartDate = !startDate || rowDate >= new Date(startDate);
        const matchesEndDate = !endDate || rowDate <= new Date(endDate);
        
        return matchesSupervisor && matchesStartDate && matchesEndDate;
    });
    
    const supervisorAnalysis = processSupervisorData(filteredData);
    displayResults(supervisorAnalysis);
    displaySummaryCards(supervisorAnalysis, filteredData);
}

function displaySummaryCards(supervisorAnalysis, allData) {
    // This function can be used to update summary cards based on filtered data
    // Implementation depends on how you want to display summary statistics
}

function clearFilters() {
    document.getElementById('supervisorFilter').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    
    filteredData = [...csvData];
    const supervisorAnalysis = processSupervisorData(filteredData);
    displayResults(supervisorAnalysis);
    displaySummaryCards(supervisorAnalysis, filteredData);
}
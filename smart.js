
// Arrays to store system data, filtered data, and ordered systems for route plotting
var allSystems = [];
var filteredSystems = [];
var orderedSystems = [];
var selectedStartSystem = '';
let sortDirection = [true, true, true, true, true, true, true, true, true];
let selectedSystemsForRoute = [];

// Format update time from seconds into readable format
function formatUpdateTime(lastUpdate) {
	const currentTime = new Date();
	const timeDifferenceInSeconds = Math.floor((currentTime.getTime() / 1000) - lastUpdate);
	const hoursDifference = Math.floor(timeDifferenceInSeconds / 3600);
	const daysDifference = Math.floor(hoursDifference / 24);

	if (hoursDifference < 24) {
		return `${hoursDifference} hours`;
	} else {
		return `${daysDifference} days`;
	}
}

// Format timestamp in seconds into a readable date format
function formatDate(timestampInSeconds) {
	const date = new Date(timestampInSeconds * 1000);
	return date.toLocaleString();
}

// Updates source data text with last update date from the data
function updateSourceDataText() {
	if (allSystems.length === 0) {
		console.error("No systems!");
		return;
	}

	const latestSystem = allSystems.reduce((latest, system) => {
		return (system.updateTimeInSeconds > latest.updateTimeInSeconds) ? system : latest;
	}, allSystems[0]);
	const formattedDate = formatDate(latestSystem.updateTimeInSeconds);
	const sourceTextElement = document.getElementById('sourceDataText');
	sourceTextElement.textContent = `Systems data from EDSM Nightly dumps, last updated on ${formattedDate}`;
}

// Load and process system data from the EDSM API
async function loadAndProcessData() {
	const tableBody = document.getElementById('systemsTable').getElementsByTagName('tbody')[0];
	tableBody.innerHTML = '';
	const loadingElement = document.getElementById('loading');
	loadingElement.style.display = 'block';
	const progressBar = document.getElementById('loading-progress-bar');
	const progressText = document.getElementById('loading-progress-text');
	progressBar.style.width = '0%';
	progressText.textContent = '0%';

	try {
		const response = await fetch('https://www.edsm.net/dump/systemsPopulated.json.gz');
		const arrayBuffer = await response.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		const decompressedData = pako.ungzip(uint8Array, { to: 'string' });
		const jsonData = JSON.parse(decompressedData);
		const systems = [];				
		const totalSystems = jsonData.length;
		let loadedSystems = 0;
		
		function updateProgressBar(loaded, total) {
			const progress = Math.round((loaded / total) * 100);
			progressBar.style.width = `${progress}%`;
			progressText.textContent = `${progress}%`;
		}				
		const chunkSize = 200;

		const processChunk = async (startIndex) => {
			const chunk = jsonData.slice(startIndex, startIndex + chunkSize);
			for (const system of chunk) {
				let canonn = false;
				let pendingStatesText = '';
				let activeStatesText = '';
				let controlled = false;
				let influence = 0;
	
				if (system.controllingFaction && system.controllingFaction.name.toLowerCase() === "canonn") {
					canonn = true;
					controlled = true;
				}

				if (system.factions) {
					system.factions.forEach(faction => {
						if (faction.name.toLowerCase() === "canonn") {
							canonn = true;
							pendingStatesText = faction.pendingStates && faction.pendingStates.length > 0
							? faction.pendingStates.map(state => state.state).join(', ')
							: 'None';
							activeStatesText = faction.activeStates && faction.activeStates.length > 0
							? faction.activeStates.map(state => state.state).join(', ')
							: 'None';
							influence = (faction.influence * 100).toFixed(1) || 0;
						}
					});
				}

				if (canonn && influence > 0) {
					const latestUpdateTime = system.factions ? getLatestUpdateTime(system.factions) : null;
					
					try {
					const deathResponse = await fetch(`https://www.edsm.net/api-system-v1/deaths?systemName=${system.name}`);
					const deathData = await deathResponse.json();
					const weekKills = deathData.deaths ? deathData.deaths.week : 0;
					const trafficResponse = await fetch(`https://www.edsm.net/api-system-v1/traffic?systemName=${system.name}`);
					const trafficData = await trafficResponse.json();
					const weekTraffic = trafficData.traffic ? trafficData.traffic.week : 0;

						systems.push({
							name: system.name,
							id: system.id,
							id64: system.id64,
							coords: system.coords,
							updateTime: latestUpdateTime,
							formattedTime: latestUpdateTime ? formatUpdateTime(latestUpdateTime) : '',
							updateTimeInSeconds: latestUpdateTime,
							pendingStates: pendingStatesText,
							activeStates: activeStatesText,
							kills: weekKills,
							traffic: weekTraffic,
							controlled: controlled,
							inf: influence,
							route: false
						});
					}
						catch (deathError) {
						console.error(`Error fetching death data for system ${system.name}:`, deathError);
					}
				}
				loadedSystems++;
				updateProgressBar(loadedSystems, totalSystems);
			}

			if (startIndex + chunkSize < totalSystems) {
				await new Promise(resolve => setTimeout(resolve, 0));
				await processChunk(startIndex + chunkSize);
			}
		};
		await processChunk(0);
		allSystems = systems;
	}	
	catch (error) {
		console.error('Error loading or processing the data:', error);
		alert('Error loading data.');
	}
	finally {
		loadingElement.style.display = 'none';
	}
	updateSourceDataText();
	updateTable();
	populateStartSystemSelect();
}

// Get latest update time from the system's factions
function getLatestUpdateTime(factions) {
	let latestUpdate = 0;
	factions.forEach(faction => {
		if (faction.lastUpdate && faction.lastUpdate > latestUpdate) {
			latestUpdate = faction.lastUpdate;
		}
	});
	return latestUpdate;
}

function toggleRoute(systemName, checkbox) {
	const system = allSystems.find(s => s.name === systemName);
	if (system) {
		if (checkbox.checked) {
			if (!filteredSystems.includes(system)) {
				filteredSystems.push(system);
			}
		}
		else {
		filteredSystems = filteredSystems.filter(s => s.name !== systemName);
		}
	}
	populateStartSystemSelect();
}

function sortTable(columnIndex) {
	const table = document.getElementById("systemsTable");
	const rows = Array.from(table.rows).slice(1);
	sortDirection[columnIndex] = !sortDirection[columnIndex];
	const headers = table.querySelectorAll('th');
	headers.forEach(header => header.classList.remove('sorted-asc', 'sorted-desc'));

	if (sortDirection[columnIndex]) {
		headers[columnIndex].classList.add('sorted-asc');
	}
	else {
		headers[columnIndex].classList.add('sorted-desc');
	}

	rows.sort((rowA, rowB) => {
		const cellA = rowA.cells[columnIndex].textContent.trim();
		const cellB = rowB.cells[columnIndex].textContent.trim();

		if (columnIndex === 4 || columnIndex === 5 || columnIndex === 6) {
			const numA = parseFloat(cellA) || 0;
			const numB = parseFloat(cellB) || 0;
			return sortDirection[columnIndex] ? numA - numB : numB - numA;
		}

		if (columnIndex === 11) {
			const timeA = rowA.cells[columnIndex].dataset.timestamp;
			const timeB = rowB.cells[columnIndex].dataset.timestamp;
			return sortDirection[columnIndex] ? timeA - timeB : timeB - timeA;
		}

		return sortDirection[columnIndex] ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
	});
	rows.forEach(row => table.appendChild(row));
}

// Update table with filtered systems
function updateTable() {
	const tableBody = document.getElementById('systemsTable').getElementsByTagName('tbody')[0];
	tableBody.innerHTML = '';

	allSystems.forEach(system => {
		const row = tableBody.insertRow();
		row.innerHTML = `
			<td><a href="#" class="system-link" data-id64="${system.id64}">${system.name}</a></td>
			<td>${system.pendingStates}</td>
			<td>${system.activeStates}</td>
			<td class="${system.controlled ? 'checked' : 'unchecked'}">
				${system.controlled ? '✔' : '❌'}
			</td>
			<td>${system.kills}</td>
			<td>${system.traffic}</td>
			<td>${system.inf}</td>
			<td class="hidden-column">${system.id64}</td>
			<td class="hidden-column">${system.coords.x}</td>
			<td class="hidden-column">${system.coords.y}</td>
			<td class="hidden-column">${system.coords.z}</td>
			<td data-timestamp="${system.updateTimeInSeconds}">${system.formattedTime}</td>
			<td>
				<input type="checkbox" 
				${selectedSystemsForRoute.some(s => s.name === system.name) ? 'checked' : ''} 
				onchange="toggleRoute('${system.name}', this)">
			</td>
		`;
	});
	sortTable(11);	// Sort by "update" column initially (column index 11)
}

// Populate start system select dropdown
function populateStartSystemSelect() {
	const startSystemSelect = document.getElementById('startSystemSelect');
	startSystemSelect.innerHTML = '<option value="">Start route from:</option>';

	filteredSystems.forEach(system => {
		const option = document.createElement('option');
		option.value = system.name;
		option.textContent = system.name;
		startSystemSelect.appendChild(option);
	});
}

// Plot route based on the selected system
function plotRoute() {
	const startSystemName = selectedStartSystem || 'Varati'; 
	const startSystem = filteredSystems.find(system => system.name === startSystemName);

		if (filteredSystems.length === 0) {
			alert('Please select at least one system for the route!');
			return;
		}
		if (!startSystem) {
			alert(`Choose your start system!!`);
			return;
		}

		orderedSystems = [startSystem];
		let remainingSystemsList = [...filteredSystems];
		remainingSystemsList = remainingSystemsList.filter(system => system !== startSystem);

		// Find closest systems and build the route
		while (remainingSystemsList.length > 0) {
			let closestSystem = remainingSystemsList[0];
			let shortestDistance = getDistance(orderedSystems[orderedSystems.length - 1], closestSystem);
			for (let system of remainingSystemsList) {
				const distance = getDistance(orderedSystems[orderedSystems.length - 1], system);
				if (distance < shortestDistance) {
					closestSystem = system;
					shortestDistance = distance;
				}
			}
			orderedSystems.push(closestSystem);
			remainingSystemsList = remainingSystemsList.filter(system => system !== closestSystem);
		}
	displayRoute(orderedSystems);
}

// Calculate distance between two systems
function getDistance(system1, system2) {
	return Math.sqrt(
		Math.pow(system2.coords.x - system1.coords.x, 2) +
		Math.pow(system2.coords.y - system1.coords.y, 2) +
		Math.pow(system2.coords.z - system1.coords.z, 2)
	);
}

// Display route and distances in the output container
function displayRoute(systems) {
	const routeContainer = document.getElementById('routeOutput');
	if (!routeContainer) {
		console.error('Container for route output not found!');
		return;
	}
	const outputTable = document.createElement('table');
	outputTable.innerHTML = `
		<tr>
			<th>System</th>
			<th>Distance</th>
		</tr>
	`;
	let totalDistance = 0;
	systems.forEach((system, index) => {
		const previousSystem = systems[index - 1];
		const distance = previousSystem ? getDistance(previousSystem, system) : 0;
		totalDistance += distance;
		const row = outputTable.insertRow();
		const systemNameCell = row.insertCell(0);
		const copyIcon = document.createElement('img');
		copyIcon.src = 'pic/copy.png';
		copyIcon.alt = 'Copy Icon';
		copyIcon.classList.add('copy-icon');
		copyIcon.onclick = () => copyToClipboard(system.name, row);
		systemNameCell.textContent = system.name;
		systemNameCell.appendChild(copyIcon);
		const distanceCell = row.insertCell(1);
		distanceCell.textContent = distance.toFixed(2);
	});
	const totalDistanceRow = outputTable.insertRow();
	totalDistanceRow.innerHTML = `
		<td><strong>Total Distance</strong></td>
		<td><strong>${totalDistance.toFixed(2)}</strong></td>
	`;
	const headers = outputTable.querySelectorAll('th');
	headers.forEach(header => {
		header.removeAttribute('onclick');
	});
	routeContainer.innerHTML = '';
	routeContainer.appendChild(outputTable);
	document.getElementById('routeOutputContainer').style.display = 'block';
}

// Copy system name to the clipboard and highlight icon
function copyToClipboard(systemName, row) {
	const textarea = document.createElement('textarea');
	textarea.value = systemName;
	document.body.appendChild(textarea);
	textarea.select();
	document.execCommand('copy');
	document.body.removeChild(textarea);
	const copyIcon = row.querySelector('.copy-icon');
	copyIcon.src = 'pic/copy_red.png';
	copyIcon.style.transition = 'src 0.3s';
}

// Generate CSV file from route data
function generateCSV(systems) {
	const headers = ['System', 'Distance'];
	let csvContent = headers.join(',') + '\n';

	let totalDistance = 0;
	systems.forEach((system, index) => {
		const previousSystem = systems[index - 1];
		const distance = previousSystem ? getDistance(previousSystem, system) : 0;
		totalDistance += distance;
		csvContent += `${system.name},${distance.toFixed(2)}\n`;
	});
	csvContent += `Total Distance,${totalDistance.toFixed(2)}\n`;
	const blob = new Blob([csvContent], { type: 'text/csv' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = 'Canonn_patrol_data.csv';
	link.click();
}

// Close the route output container
function closeRouteContainer() {
	document.getElementById('routeOutputContainer').style.display = 'none';
}

// Event listeners for user interaction
document.getElementById('systemsTable').addEventListener('click', function(event) {
	if (event.target && event.target.matches('a.system-link')) {
		const systemName = event.target.textContent.trim();
		const sourceFilterValue = document.getElementById('sourceFilter').value;
		const system = allSystems.find(s => s.name === systemName);
		if (!system) {
			console.error('System not found!');
			return;
		}
		let url = '';
		switch (sourceFilterValue) {
			case 'inara':
				url = `https://inara.cz/elite/starsystem/?search=${system.id64}`;
				break;
			case 'edsm':
				url = `https://www.edsm.net/en/system/id/${system.id}/name`;
				break;
			case 'spansh':
				url = `https://spansh.co.uk/system/${system.id64}`;
				break;
			default:
			console.error('Unknown source selected!');
			return;
		}
		window.open(url, '_blank');
	}
});
document.getElementById('startSystemSelect').addEventListener('change', function(e) {
	selectedStartSystem = e.target.value;
});
document.getElementById('downloadCSVBtn').addEventListener('click', function() {
	generateCSV(orderedSystems);
});
document.getElementById('routeBtn').addEventListener('click', plotRoute);
document.getElementById('closeRouteBtn').addEventListener('click', closeRouteContainer);

// Load and process data when the page loads
window.onload = loadAndProcessData;
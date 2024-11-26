
// Arrays to store system data, filtered data, and ordered systems for route plotting
var factionSystems = [];
var filteredSystems = [];
var orderedSystems = [];
var selectedStartSystem = '';
let sortDirection = [true, true, true, true, true, true, true, true];
let selectDeselect = [];
let totalSystems = 0;
let loadedSystems = 0;
let selectedFaction = "canonn";
let selectedFactionDisplay = "Canonn";
let savedFactions = ["canonn"];

// Update progress bar
function updateProgressBar() {
	const progressBar = document.getElementById('loading-progress-bar');
	const progressText = document.getElementById('loading-progress-text');
	const progress = Math.round((loadedSystems / totalSystems) * 100);
	progressBar.style.width = `${progress}%`;
	progressText.textContent = `${progress}%`;
}

// Reset progress bar
function resetProgressBar() {
	const progressBar = document.getElementById('loading-progress-bar');
	const progressText = document.getElementById('loading-progress-text');
	progressBar.style.width = '0%';
	progressText.textContent = '0%';
}

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

// Update last tick
async function lastTick() {
	const time = await fetch('https://elitebgs.app/api/ebgs/v5/ticks?time');
	const tickData = await time.json();
	const tickTime = tickData[0].time;
	const date = new Date(tickTime);
	const formattedTime = date.toLocaleString();
	const sourceTextElement = document.getElementById('sourceDataText');
	sourceTextElement.textContent = `Faction data from Elite BGS, Power data from EDSM, last tick ${formattedTime}`;
}

function saveFactionData(factionName, systemData) {
	let factions = JSON.parse(sessionStorage.getItem('factions')) || {};
	if (!factions[factionName]) {
		factions[factionName] = {};
	}
	factions[factionName] = systemData;
	sessionStorage.setItem('factions', JSON.stringify(factions));
}

function loadFactionData(factionName) {
	const factions = JSON.parse(sessionStorage.getItem('factions')) || {};
	if (factions[factionName]) {
		return factions[factionName];
	} else {
		console.log('No faction data');
		return null;
	}
}

// Load and process system data from the Elite BGS API
async function loadAndProcessData() {
	const tableBody = document.getElementById('systemsTable').getElementsByTagName('tbody')[0];
	tableBody.innerHTML = '';
	clearOldRows();
	const loadingElement = document.getElementById('loading');
	loadingElement.style.display = 'block';
	factionSystems = [];
	filteredSystems = [];
	orderedSystems = [];
	loadedSystems = 0;
	totalSystems = 0;
	resetProgressBar();
	const selectedFactionName = selectedFaction;
	let factionData = loadFactionData(selectedFactionName);

	if (factionData) {
		factionSystems = factionData;
		lastTick();
		updateTable();
		populateStartSystemSelect();
		loadingElement.style.display = 'none';
		return;
	}
	try {
		const powerPlayResponse = await fetch('powerPlay_test.json');
		const powerPlayData = await powerPlayResponse.json();
		const factionResponse = await fetch(`https://elitebgs.app/api/ebgs/v5/factions?name=${selectedFaction}`);
		const factionData = await factionResponse.json();
		const systems = [];
		totalSystems = factionData.docs.reduce((count, faction) => count + faction.faction_presence.length, 0);
		for (const faction of factionData.docs) {
			for (const factionInfo of faction.faction_presence) {
				const systemName = factionInfo.system_name;
				const systemDetailsResponse = await fetch(`https://elitebgs.app/api/ebgs/v5/systems?name=${systemName}`);
				const systemDetailsData = await systemDetailsResponse.json();

				if (systemDetailsData.docs.length > 0) {
					const systemDetails = systemDetailsData.docs[0];
					const latestUpdateTime = new Date(factionInfo.updated_at).getTime() / 1000;
					let pendingStatesText = '';
					let activeStatesText = '';
					let recoveryStatesText = '';
					let conflictsStatesText = '';
					let systemPower = '-';
					let powerState = '-';
					let factionStations = 0;
					let controlledText = false;
					let powerLatestUpdateTime = 0;
					let influence = factionInfo.influence ? (factionInfo.influence * 100).toFixed(1) : 0;
					const powerInfo = powerPlayData.find(power => power.name === systemName);
					
					if (powerInfo) {
						systemPower = powerInfo.power;
						powerState = powerInfo.powerState;
					}
					if (systemDetails.controlling_minor_faction.trim().toLowerCase() === selectedFactionDisplay.trim().toLowerCase()) {
						controlledText = true;
					}
					if (factionInfo.pending_states && factionInfo.pending_states.length > 0) {
						pendingStatesText = factionInfo.pending_states.map(state => state.state).join(', ');
					} else {
						pendingStatesText = 'None';
					}
					if (factionInfo.active_states && factionInfo.active_states.length > 0) {
						activeStatesText = factionInfo.active_states.map(state => state.state).join(', ');
					} else {
						activeStatesText = 'None';
					}
					if (factionInfo.recovering_states && factionInfo.recovering_states.length > 0) {
						recoveryStatesText = factionInfo.recovering_states.map(state => state.state).join(', ');
					} else {
						recoveryStatesText = 'None';
					}
					const stationsResponse = await fetch(`https://elitebgs.app/api/ebgs/v5/stations?system=${systemName}`);
					const stationsData = await stationsResponse.json();
					if (stationsData.docs.length > 0) {
						stationsData.docs.forEach(station => {
							if (station.controlling_minor_faction.trim().toLowerCase() === selectedFactionDisplay.trim().toLowerCase()) {
								factionStations++;
							}
						});
					}

					systems.push({
						name: systemName,
						id64: systemDetails.system_address,
						elitebgs_id: systemDetails._id,
						coords: {
							x: systemDetails.x,
							y: systemDetails.y,
							z: systemDetails.z
						},
						formattedTime: formatUpdateTime(latestUpdateTime),
						updateTimeInSeconds: latestUpdateTime,
						stations: factionStations,
						pendingStates: pendingStatesText,
						activeStates: activeStatesText,
						recoveryStates: recoveryStatesText,
						influence: influence,
						power: systemPower,
						state: powerState,
						controlled: controlledText,
						route: false
					});
				}
				loadedSystems++;
				updateProgressBar();
			}
		}
		factionSystems = systems;
		saveFactionData(selectedFactionName, factionSystems);
	} catch (error) {
		console.error('Error loading or processing the data:', error);
		alert('Error loading data.');
	} finally {
		loadingElement.style.display = 'none';
	}
	lastTick();
	updateTable();
	populateStartSystemSelect();
}

// Toggle route checkbox for a system (add/remove it from the route)
function toggleRoute(systemName, checkbox) {
	const system = factionSystems.find(s => s.name === systemName);
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

// Clear all rows from the table (except the header)
function clearOldRows() {
	const table = document.getElementById("systemsTable");
	const rows = table.querySelectorAll("tr");
	rows.forEach((row, index) => {
		if (index !== 0) {
			row.remove();
		}
	});
}

// Sort table based on the selected column
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

		if (columnIndex === 6 || columnIndex === 2) {
			const numA = parseFloat(cellA) || 0;
			const numB = parseFloat(cellB) || 0;
			return sortDirection[columnIndex] ? numA - numB : numB - numA;
		}

		if (columnIndex === 14) {
			const timeA = rowA.cells[columnIndex].dataset.timestamp;
			const timeB = rowB.cells[columnIndex].dataset.timestamp;
			return sortDirection[columnIndex] ? timeA - timeB : timeB - timeA;
		}

		return sortDirection[columnIndex] ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
	});
	rows.forEach((row, index) => {
		table.appendChild(row);
		const rowNumberCell = row.cells[0];
		rowNumberCell.textContent = index + 1;
	});
}

// Update table with filtered systems
function updateTable() {
	const tableBody = document.getElementById('systemsTable').getElementsByTagName('tbody')[0];
	tableBody.innerHTML = '';
	clearOldRows();
	let rowNumber = 1;

	factionSystems.forEach(system => {
		const row = tableBody.insertRow();
		row.innerHTML = `
			<td class="row-number">${rowNumber}</td> 
			<td><a href="#" class="system-link" data-id64="${system.id64}">${system.name}</a></td>
			<td>${system.influence}</td>
			<td>${system.pendingStates}</td>
			<td>${system.activeStates}</td>
			<td>${system.recoveryStates}</td>
			<td>${system.stations}</td>
			<td class="${system.controlled ? 'checked' : 'unchecked'}">
				${system.controlled ? '✔' : '❌'}
			</td>
			<td>${system.power}</td>
			<td>${system.state}</td>
			<td class="hidden-column">${system.id64}</td>
			<td class="hidden-column">${system.coords.x}</td>
			<td class="hidden-column">${system.coords.y}</td>
			<td class="hidden-column">${system.coords.z}</td>
			<td data-timestamp="${system.updateTimeInSeconds}">${system.formattedTime}</td>
			<td>
				<input type="checkbox" 
				${selectDeselect.some(s => s.name === system.name) ? 'checked' : ''} 
				onchange="toggleRoute('${system.name}', this)">
			</td>
		`;
		rowNumber++;
	});
}

// Populate start system select dropdown
function populateStartSystemSelect() {
	const startSystemSelect = document.getElementById('startSystemSelect');
	startSystemSelect.innerHTML = '<option value="" disabled selected>Start route from:</option>';

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

// Handles change in faction selection (dropdown or custom input)
function handleFactionChange(event) {
	var otherFactionInput = document.getElementById("otherFactionInput");
	var factionSelect = document.getElementById("factionSelect");

	if (event.target === factionSelect) {
		if (factionSelect.value === "otherFaction") {
			otherFactionInput.style.display = "block";
			otherFactionInput.value = "";
		} else {
			otherFactionInput.style.display = "none";
			selectedFactionDisplay = factionSelect.value;
			selectedFaction = factionSelect.value.replace(/\s+/g, '+');
			if (selectedFaction === "startFaction") {
				selectedFaction = "canonn";
			}
			loadAndProcessData();
		}
	}
	if (event.target === otherFactionInput && event.key === "Enter") {
		let enteredFaction = otherFactionInput.value.trim();
		if (enteredFaction.length > 0) {
			if (!savedFactions.includes(enteredFaction)) {
				savedFactions.push(enteredFaction);
				updateFactionSelect();
			}
			selectedFaction = enteredFaction.replace(/\s+/g, '+');
			selectedFactionDisplay = enteredFaction;
			factionSelect.value = enteredFaction; 
			otherFactionInput.style.display = "none";
			loadAndProcessData();
		} else {
			otherFactionInput.style.display = "none";
		}
	}
}

function updateFactionSelect() {
	const factionSelect = document.getElementById("factionSelect");
	while (factionSelect.options.length > 1) {
		factionSelect.remove(1);
	}
	savedFactions.forEach(faction => {
		if (faction !== "otherFaction" && faction !== "canonn") {
			let option = document.createElement("option");
			option.value = faction;
			option.textContent = faction;
			factionSelect.appendChild(option);
		}
	});
	let otherOption = document.createElement("option");
	otherOption.value = "otherFaction";
	otherOption.textContent = "Other faction...";
	factionSelect.appendChild(otherOption);
	const defaultOption = factionSelect.querySelector('option[value="canonn"]');
	if (defaultOption) {
		factionSelect.value = "canonn";
	} else {
		let canonnOption = document.createElement("option");
		canonnOption.value = "canonn";
		canonnOption.textContent = "Canonn";
		factionSelect.insertBefore(canonnOption, factionSelect.firstChild);
		factionSelect.value = "canonn";
	}
	const startFactionOption = factionSelect.querySelector('option[value="startFaction"]');
	if (startFactionOption) {
		startFactionOption.style.display = "none";
	}
}

// "select/deselect all" button click to toggle checkboxes
document.getElementById('selectBtn').addEventListener('click', function() {
	const checkboxes = document.querySelectorAll('#systemsTable input[type="checkbox"]');
	const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
	checkboxes.forEach(checkbox => {
		checkbox.checked = !allChecked;
		const systemName = checkbox.closest('tr').querySelector('.system-link').textContent.trim();
		const system = factionSystems.find(s => s.name === systemName);
		if (checkbox.checked && system && !filteredSystems.includes(system)) {
			filteredSystems.push(system);
		} else if (!checkbox.checked) {
			filteredSystems = filteredSystems.filter(s => s.name !== systemName);
		}
	});
	populateStartSystemSelect();
});

// Event listeners for website
document.getElementById('systemsTable').addEventListener('click', function(event) {
	if (event.target && event.target.matches('a.system-link')) {
		const systemName = event.target.textContent.trim();
		const websiteFilterValue = document.getElementById('websiteFilter').value;
		const system = factionSystems.find(s => s.name === systemName);
		if (!system) {
			console.error('System not found!');
			return;
		}

		let url = '';
		switch (websiteFilterValue) {
			case 'elitebgs':
				url = `https://elitebgs.app/systems/${system.elitebgs_id}`;
				break;
			case 'inara':
				url = `https://inara.cz/elite/starsystem/?search=${system.id64}`;
				break;
			case 'edsm':
				fetch(`https://www.edsm.net/api-system-v1/estimated-value?systemName=${encodeURIComponent(systemName)}`)
					.then(response => response.json())
					.then(data => {
						if (data && data.url) {
							url = data.url;
							window.open(url, '_blank');
						} else {
							console.error('No URL found in EDSM API response.');
						}
					})
					.catch(error => {
						console.error('Error fetching system data from EDSM API:', error);
					});
				return;
			case 'spansh':
				url = `https://spansh.co.uk/system/${system.id64}`;
				break;
			default:
				console.error('Unknown source selected!');
				return;
		}
		if (url) {
			window.open(url, '_blank');
		}
	}
});
document.getElementById('startSystemSelect').addEventListener('change', function(e) {
	selectedStartSystem = e.target.value;
});
document.getElementById('downloadCSVBtn').addEventListener('click', function() {
	generateCSV(orderedSystems);
});
document.getElementById("factionSelect").addEventListener("change", handleFactionChange);
document.getElementById("otherFactionInput").addEventListener("keydown", handleFactionChange);
document.getElementById('routeBtn').addEventListener('click', plotRoute);
document.getElementById('closeRouteBtn').addEventListener('click', closeRouteContainer);

// Load and process data when the page loads
window.onload = loadAndProcessData;
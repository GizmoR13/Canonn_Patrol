
// Arrays to store system data
let factionSystems = [];
let filteredSystems = [];
let orderedSystems = [];
let selectedStartSystem = '';
let sortDirection = [];
let selectDeselect = [];
let totalSystems = 0;
let loadedSystems = 0;
let selectedFaction = "Canonn";
let savedFactions = [];
let factionStatus = null;

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

function updateFactionTimestamp(timestamp) {
	const factionTextElement = document.getElementById('factionDataText');
	factionTextElement.textContent = `${selectedFaction} data from ${new Date(timestamp).toLocaleString()}`;
}

// Update last tick
async function lastTick() {
	const tickData = await fetchData('GetTick', { time: true });
	const tickTime = tickData[0].time;
	const date = new Date(tickTime);
	const formattedTime = date.toLocaleString();
	const sourceTextElement = document.getElementById('sourceDataText');
	sourceTextElement.textContent = `Data from Elite BGS, last tick ${formattedTime}`;
}

async function loadFactionStatus() {
  try {
	const data = await fetchData('GetStatus', {});
	factionStatus = {
	  peaceAgreement: data.peaceAgreement,
	  deadFactions: data.deadFactions,
	  noContact: data.noContact
	};
  } catch (error) {
	console.error("Error loading faction data:", error);
	return null;
  }
}

function saveFactionData(factionName, systemData) {
	let factions = JSON.parse(localStorage.getItem('factions')) || {};
	const timestamp = Date.now();
	if (!factions[factionName]) {
		factions[factionName] = {};
	}
	factions[factionName] = {
		systems: systemData,
		timestamp: timestamp
	};
	localStorage.setItem('factions', JSON.stringify(factions));
}

function loadFactionData(factionName) {
	const factions = JSON.parse(localStorage.getItem('factions')) || {};
	if (factions[factionName]) {
		return factions[factionName];
	} else {
		return null;
	}
}

function clearFactionData(key) {
	if (key === "data") {
		localStorage.removeItem('factions');
		console.log('All systems data cleared. Local Storage size: ' + getStorageSize() + ' KB');
	} else if (key === "list") {
		localStorage.removeItem('savedFactions');
		console.log('Faction list cleared. Local Storage size: ' + getStorageSize() + ' KB');
	} else {
		console.error('Unknown key: ' + key);
	}
	checkLocalStorageForData();
}

function checkLocalStorageForData() {
	const factionsExist = localStorage.getItem('savedFactions') !== null;
	const dataExist = localStorage.getItem('factions') !== null;
	const clearListBtn = document.getElementById('clearListBtn');
	const clearDataBtn = document.getElementById('clearDataBtn');

	if (!factionsExist) {
		clearListBtn.classList.add('disabled');
		clearListBtn.disabled = true;
	} else {
		clearListBtn.classList.remove('disabled');
		clearListBtn.disabled = false;
	}
	if (!dataExist) {
		clearDataBtn.classList.add('disabled');
		clearDataBtn.disabled = true;
	} else {
		clearDataBtn.classList.remove('disabled');
		clearDataBtn.disabled = false;
	}
}

function getStorageSize() {
	let total = 0;
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		const value = localStorage.getItem(key);
		total += Math.round(((key.length + value.length) * 2) / 1024);
	}
	return total;
}

function checkVersion() {
	const Ver = 1.5;
	const storedVersion = localStorage.getItem("Ver");
	if (storedVersion === null || parseFloat(storedVersion) !== Ver) {
		clearFactionData("data");
		localStorage.setItem("Ver", Ver);
	}
}

async function onStart() {
	checkVersion();
	const selectedFactionName = selectedFaction;
	let factionData = loadFactionData(selectedFactionName);
	const savedFactionsFromStorage = localStorage.getItem('savedFactions');
	savedFactions = JSON.parse(savedFactionsFromStorage) || ["Canonn", "Canonn Deep Space Research"];
	updateFactionSelect();
	checkLocalStorageForData();
	await loadFactionStatus();
	loadColumnVisibility();
	if (factionData) {
		factionSystems = factionData.systems;
		const timestamp = factionData.timestamp;
		updateFactionTimestamp(timestamp);
		lastTick();
		updateTable();
		populateStartSystemSelect();
		
	} else {
		loadAndProcessData();
	}
}

async function fetchSystemUrl(params) {
	let url = '';
	const systemName = params.systemName;
	const websiteFilterValue = params.websiteFilterValue;
	switch (websiteFilterValue) {
		case 'elitebgs':
			url = `https://elitebgs.app/systems/${params.elitebgs_id}`;
			break;
		case 'inara':
			url = `https://inara.cz/elite/starsystem/?search=${params.id64}`;
			break;
		case 'edsm':
			url = await fetchEdsmUrl(systemName);
			break;
		case 'spansh':
			url = `https://spansh.co.uk/system/${params.id64}`;
			break;
		default:
			throw new Error('Unknown source selected!');
	}
	return url;
}

async function fetchEdsmUrl(systemName) {
	try {
		const response = await fetch(`https://www.edsm.net/api-system-v1/estimated-value?systemName=${encodeURIComponent(systemName)}`);
		const data = await response.json();
		if (data && data.url) {
			const modifiedUrl = data.url.replace('/bodies', '');
			return modifiedUrl;
		} else {
			console.error('No URL found in EDSM API response.');
			return null;
		}
	} catch (error) {
		console.error('Error fetching system data from EDSM API:', error);
		return null;
	}
}

async function fetchData(site, params = {}) {
	let url = '';
	switch (site) {
		case 'getStations':
			url = 'https://elitebgs.app/api/ebgs/v5/stations';
			break;
		case 'getSystem':
			url = 'https://elitebgs.app/api/ebgs/v5/systems';
			break;
		case 'GetFaction':
			url = 'https://elitebgs.app/api/ebgs/v5/factions';
			break;
		case 'GetTick':
			url = 'https://elitebgs.app/api/ebgs/v5/ticks';
			break;
		case 'GetPowers':
			url = 'json/power.json';
			break;
		case 'GetStatus':
			url = 'json/factions_status.json';
			break;
		case 'GetPlayersFactions':
			url = 'json/ED_Player_Factions.json';
			break;
		case 'GetInfo':
			url = 'json/info.json';
			break;
		default:
			throw new Error('Unknown site type');
	}
	return await fetchJson(url, params);
}

async function fetchJson(url, params = {}) {
	try {
		let response;
		if (url.endsWith('.json')) {
			response = await fetch(url);
		} else {
			let queryParams = new URLSearchParams(params).toString();
			if (queryParams) {
				url += '?' + queryParams;
			}
			response = await fetch(url);
		}
		if (!response.ok) {
			throw new Error(`Failed to fetch data from ${url}, server offline?`);
		}
		const data = await response.json();
		return data;
	} catch (error) {
		console.error(error);
		return null;
	}
}

function getDecoded(band) {
	const decodeBands = {
		"$faction_happinessband1;": "Elated",
		"$faction_happinessband2;": "Happy",
		"$faction_happinessband3;": "Discontented",
		"$faction_happinessband4;": "Unhappy",
		"$faction_happinessband5;": "Despondent",
		"independent": "Independent",
		"pilotsfederation": "Pilots Federation",
		"federation": "Federation",
		"empire": "Empire",
		"alliance": "Alliance",
		"guardian": "Guardian",
		"thargoid": "Thargoid",
		"playerpilots": "Player Pilots",
		"$government_anarchy;": "Anarchy",
		"$government_communism;": "Communism",
		"$government_confederacy;": "Confederacy",
		"$government_cooperative;": "Cooperative",
		"$government_corporate;": "Corporate",
		"$government_democracy;": "Democracy",
		"$government_dictatorship;": "Dictatorship",
		"$government_feudal;": "Feudal",
		"$government_imperial;": "Imperial",
		"$government_none;": "None",
		"$government_patronage;": "Patronage",
		"$government_prisoncolony;": "Prison Colony",
		"$government_theocracy;": "Theocracy",
		"$government_engineer;": "Engineer",
		"$government_carrier;": "Private Ownership",
		"$economy_agri;": "Agriculture",
		"$economy_colony;": "Colony",
		"$economy_extraction;": "Extraction",
		"$economy_hightech;": "High Tech",
		"$economy_industrial;": "Industrial",
		"$economy_military;": "Military",
		"$economy_none;": "None",
		"$economy_refinery;": "Refinery",
		"$economy_service;": "Service",
		"$economy_terraforming;": "Terraforming",
		"$economy_tourism;": "Tourism",
		"$economy_prison;": "Prison",
		"$economy_damaged;": "Damaged",
		"$economy_rescue;": "Rescue",
		"$economy_repair;": "Repair",
		"$economy_carrier;": "Private Enterprise",
		"$economy_engineer;": "Engineering",
		"$galaxy_map_info_state_anarchy;": "Anarchy",
		"$galaxy_map_info_state_lawless;": "Lawless",
		"$system_security_high;": "High",
		"$system_security_low;": "Low",
		"$system_security_medium;": "Medium"
	};
	return decodeBands[band] || " ";
}

// Load and process system data from Elite BGS API
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

	try {
		const encodedFactionName = selectedFaction.replace(/&/g, '%26');
		const powerPlayData = await fetchData('GetPowers', {});
		const factionData = await fetchData('GetFaction', { name: encodedFactionName });
		const playerFactionsData = await fetchData('GetPlayersFactions', {});
		const systems = [];
		totalSystems = factionData.docs.reduce((count, faction) => count + faction.faction_presence.length, 0);
		const allSystemPromises = [];
		for (const faction of factionData.docs) {
			for (const factionInfo of faction.faction_presence) {
				const systemName = factionInfo.system_name;
				const systemDetailsData = await fetchData('getSystem', { name: systemName });
				if (systemDetailsData.docs.length > 0) {
					const systemDetails = systemDetailsData.docs[0];
					const latestUpdateTime = new Date(factionInfo.updated_at).getTime() / 1000;
					let systemPower = '';
					let powerState = '';
					let controlledText = false;
					let otherPlayerSystem = false;
					let otherPlayerHome = false;
					let otherFactionsData = [];
					let homeSystemCoords = [];
					let systemStations = 0;
					let currentFactionStations = 0;
					let influenceColor = 0;
					const powerInfo = powerPlayData.find(power => power.name === systemName);
					
					const factionPromises = systemDetails.factions.map(async (faction) => {
						const allFactionData = await loadOthersData(systemName, faction.name, faction.faction_id, playerFactionsData);
						const existingSystem = otherFactionsData.find(item => item.systemName === systemName);
						if (existingSystem) {
							existingSystem.factions.push({
								factionName: faction.name,
								data: allFactionData
							});
						} else {
							otherFactionsData.push({
								systemName: systemName,
								factions: [{
									factionName: faction.name,
									data: allFactionData
								}]
							});
						}
					});
					allSystemPromises.push(Promise.all(factionPromises));
					await Promise.all(allSystemPromises);

					const systemData = otherFactionsData.find(system => system.systemName === systemName);
					if (systemData) {
						let selectedFactionInfluence = 0;
						let minInfluenceDifference = Infinity;
						const selectedFactionData = systemData.factions.find(faction => 
							faction.factionName.trim().toLowerCase() === selectedFaction.trim().toLowerCase()
						);
						if (selectedFactionData) {
							selectedFactionInfluence = parseFloat(selectedFactionData.data[0].influence);
						}
						systemData.factions.forEach(faction => {
							if (faction.factionName.trim().toLowerCase() !== selectedFaction.trim().toLowerCase() && faction.data.length > 0) {
								const otherFactionInfluence = parseFloat(faction.data[0].influence);
								const influenceDifference = Math.abs(selectedFactionInfluence - otherFactionInfluence);
								if (influenceDifference < minInfluenceDifference) {
									minInfluenceDifference = influenceDifference;
								}
							}
						});
						if (minInfluenceDifference < 5) {
							influenceColor = 2;
						} else if (minInfluenceDifference < 10) {
							influenceColor = 1;
						} else {
							influenceColor = 0;
						}
						if (systemData.factions.find(faction => 
							faction.data && faction.data.length > 0 &&
							faction.data[0].playerFaction === true &&
							faction.factionName.trim().toLowerCase() !== selectedFaction.trim().toLowerCase()
						)) {
							otherPlayerSystem = true;
						}
						if (systemData.factions.find(faction => 
							faction.data && faction.data.length > 0 &&
							faction.data[0].playerFactionHome === systemName &&
							faction.factionName.trim().toLowerCase() !== selectedFaction.trim().toLowerCase()
						)) {
							otherPlayerHome = true;
						}
						if (systemData.factions.find(faction => 
							faction.data && faction.data.length > 0 &&
							faction.data[0].playerFactionHome === systemName &&
							faction.factionName.trim().toLowerCase() === selectedFaction.trim().toLowerCase()
						)) {
							homeSystemCoords = {
								coords: {
									x: systemDetails.x,
									y: systemDetails.y,
									z: systemDetails.z
								}
							};
						}
						const factionData = systemData.factions.find(faction => faction.factionName.trim().toLowerCase() === selectedFaction.trim().toLowerCase());
						if (factionData && factionData.data.length > 0) {
							systemStations = factionData.data[0].systemStations || 0;
							currentFactionStations = factionData.data[0].factionStations || 0;
						} else {
							console.log('No faction or faction data for:', selectedFaction);
						}
					} else {
						console.log('No ', systemName, ' in detailed data');
					}
					if (powerInfo) {
						systemPower = powerInfo.power;
						powerState = powerInfo.powerState;
					}
					if (systemDetails.controlling_minor_faction.trim().toLowerCase() === selectedFaction.trim().toLowerCase()) {
						controlledText = true;
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
						homeSystemCoords: homeSystemCoords,
						formattedTime: formatUpdateTime(latestUpdateTime),
						updateTimeInSeconds: latestUpdateTime,
						pendingStates: factionInfo.pending_states.map(state => state.state).join(', ') || '-',
						activeStates: factionInfo.active_states.map(state => state.state).join(', ') || '-',
						recoveryStates: factionInfo.recovering_states.map(state => state.state).join(', ') || '-',
						allegiance: getDecoded(systemDetails.allegiance),
						government: getDecoded(systemDetails.government),
						primary_economy: getDecoded(systemDetails.primary_economy),
						secondary_economy: getDecoded(systemDetails.secondary_economy),
						security: getDecoded(systemDetails.security),
						happiness: getDecoded(factionInfo.happiness),
						population: systemDetails.population,
						stations: systemStations,
						currentFactionStations: currentFactionStations,
						influence: factionInfo.influence ? (factionInfo.influence * 100).toFixed(1) : 0,
						influenceColor: influenceColor,
						power: systemPower,
						state: powerState,
						controlling: systemDetails.controlling_minor_faction,
						controlled: controlledText,
						othersData: otherFactionsData,
						otherPlayerSystem: otherPlayerSystem,
						otherPlayerHome: otherPlayerHome,
						conflictsData: systemDetails.conflicts,
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
		console.error('Error loading or processing data:', error);
		alert('Error loading data.');
	} finally {
		loadingElement.style.display = 'none';
	}
	updateFactionTimestamp(Date.now());
	lastTick();
	updateTable();
	populateStartSystemSelect();
	console.log("LocalStorage size: " + getStorageSize() + " KB");
}

async function loadOthersData(systemName, factionName, factionId, playerFactionsData) {
	let data = [];
	let factionStations = 0;
	let systemStations = 0;
	let playerFaction = false;
	let playerFactionHome = '';
	let page = 1;
	let hasNextPage = true;
	let stationsData = [];

	while (hasNextPage) {
		const pageData = await fetchData('getStations', { system: systemName, page: page });
		stationsData = pageData.docs;
		stationsData.forEach(station => {
			if (station.controlling_minor_faction && station.controlling_minor_faction.trim().toLowerCase() === factionName.trim().toLowerCase()) {
				factionStations++;
			}
			systemStations++;
		});
		if (pageData.pages > page) {
			page++;
		} else {
			hasNextPage = false;
		}
	}
	const factionsData = await fetchData('GetFaction', { id: factionId });
	const factionsDocs = factionsData.docs;
	for (const faction of factionsDocs) {
		const factionPresence = faction.faction_presence.find(presence => presence.system_name.toLowerCase() === systemName.toLowerCase());
		if (factionPresence) {
			playerFaction = playerFactionsData.some(factionData => 
				factionData.Faction && factionData.Faction.trim().toLowerCase() === factionName.trim().toLowerCase()
			);
			if (playerFaction) {
				const playerFactionData = playerFactionsData.find(factionData => 
					factionData.Faction && factionData.Faction.trim().toLowerCase() === factionName.trim().toLowerCase()
				);
				if (playerFactionData) {
					playerFactionHome = playerFactionData.System;
				}
			}
			const factionDetails = {
				influence: (factionPresence.influence * 100).toFixed(1),
				active_states: factionPresence.active_states.map(state => state.state).join(', ') || '-',
				pending_states: factionPresence.pending_states.map(state => state.state).join(', ') || '-',
				recovering_states: factionPresence.recovering_states.map(state => state.state).join(', ') || '-',
				allegiance: faction.allegiance || '',
				government: faction.government || '',
				happiness: getDecoded(factionPresence.happiness) || '',
				playerFactionHome: playerFactionHome,
				playerFaction: playerFaction,
				factionStations: factionStations || 0,
				systemStations: systemStations || 0
			};
			data.push(factionDetails);
		}
	}
	return data;
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

// Clear all rows from table (except header)
function clearOldRows() {
	const table = document.getElementById("systemsTable");
	const rows = table.querySelectorAll("tr");
	rows.forEach((row, index) => {
		if (index !== 0) {
			row.remove();
		}
	});
}

// Sort table based on selected column
function sortTable(columnIndex) {
	const table = document.getElementById("systemsTable");
	const rows = Array.from(table.querySelectorAll('tr.main-row'));
	sortDirection[columnIndex] = !sortDirection[columnIndex];
	const existingSubRows = document.querySelectorAll('.sub-row');
	existingSubRows.forEach(subRow => {
		subRow.style.display = 'none';
	});
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
		if (columnIndex === 20 || columnIndex === 15 || columnIndex === 16 || columnIndex === 2) {
			const numA = parseFloat(cellA) || 0;
			const numB = parseFloat(cellB) || 0;
			return sortDirection[columnIndex] ? numA - numB : numB - numA;
		}
		if (columnIndex === 12 || columnIndex === 23) {
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
	addSubRows();
	toggleColumnVisibility();
}

// Update table with systems
function updateTable() {
	const tableBody = document.getElementById('systemsTable').getElementsByTagName('tbody')[0];
	tableBody.innerHTML = '';
	clearOldRows();
	let rowNumber = 1;
	let systemConflicts = 0;
	let factionConflicts = 0;
	const { peaceAgreement, deadFactions, noContact } = factionStatus;
	let homeCoords;
	factionSystems.forEach(system => {
		if (!homeCoords && system.homeSystemCoords && system.homeSystemCoords.coords) {
			homeCoords = system.homeSystemCoords;
		}
	});
	if (!homeCoords) {
		homeCoords = {
			coords: {
				x: -178.65625,
				y: 77.125,
				z: -87.125
			}
		};
	}
	factionSystems.forEach(system => {
		let systemClass = '';
		if (system.othersData && system.othersData.some(systemData => 
			systemData.factions.some(faction => peaceAgreement.includes(faction.factionName))
		)) {
			systemClass = 'peace-agreement';
		} else if (system.othersData && system.othersData.some(systemData => 
			systemData.factions.some(faction => noContact.includes(faction.factionName))
		)) {
			systemClass = 'no-contact';
		} else if (system.othersData && system.othersData.some(systemData => 
			systemData.factions.some(faction => deadFactions.includes(faction.factionName))
		)) {
			systemClass = 'dead-factions';
		} else if (system.otherPlayerSystem) {
			systemClass = 'other-player-system';
		}
		const conflicts = extractConflicts(system);
		systemConflicts = conflicts.length;
		factionConflicts = conflicts.filter(conflict => 
			conflict.faction1 === selectedFaction || conflict.faction2 === selectedFaction
		).length;
		const row = tableBody.insertRow();
		row.classList.add('main-row');
		if (systemClass) {
			row.classList.add(systemClass);
		}
		let influenceClass = '';
		if (system.influenceColor === 1) {
			influenceClass = 'influence-yellow';
		} else if (system.influenceColor === 2) {
			influenceClass = 'influence-red';
		}
		row.innerHTML = `
			<td class="row-number">${rowNumber}</td> 
			<td><a href="#" class="system-link" data-id64="${system.id64}">${system.name}</a></td>
			<td data-index="3" class="${influenceClass}">${system.influence}</td>
			<td data-index="4">${system.pendingStates}</td>
			<td data-index="5">${system.activeStates}</td>
			<td data-index="6">${system.recoveryStates}</td>
			<td data-index="7">${system.allegiance}</td>
			<td data-index="8">${system.government}</td>
			<td data-index="9">${system.primary_economy}</td>
			<td data-index="10">${system.secondary_economy}</td>
			<td data-index="11">${system.security}</td>
			<td data-index="12">${system.happiness}</td>
			<td data-index="13" data-timestamp="${system.population}">${system.population.toLocaleString()}</td>
			<td data-index="14">${systemConflicts}</td>
			<td data-index="15">${factionConflicts}</td>
			<td data-index="16">${system.stations}</td>
			<td data-index="17">${system.currentFactionStations}</td>
			<td data-index="18" class="${system.otherPlayerSystem ? 'checked' : 'unchecked'}">
				${system.otherPlayerSystem ? '✔' : '✖'}
			</td>
			<td data-index="19" class="${system.otherPlayerHome ? 'checked' : 'unchecked'}">
				${system.otherPlayerHome ? '✔' : '✖'}
			</td>
			<td data-index="20" class="${system.controlled ? 'checked' : 'unchecked'}">
				${system.controlled ? '✔' : '✖'}
			</td>
			<td data-index="21">${getDistance(homeCoords, system).toFixed(0) + " Ly"}</td>
			<td data-index="22">${system.power}</td>
			<td data-index="23">${system.state}</td>
			<td data-index="24" data-timestamp="${system.updateTimeInSeconds}">${system.formattedTime}</td>
			<td>
				<input type="checkbox" 
				${selectDeselect.some(s => s.name === system.name) ? 'checked' : ''} 
				onchange="toggleRoute('${system.name}', this)">
			</td>
		`;
		rowNumber++;
		row.system = system;
		tableBody.appendChild(row);
	});
	addSubRows();
	toggleColumnVisibility();
}

function extractConflicts(system) {
	const conflictResults = [];
	
	function normalizeFactionName(factionName) {
		return factionName.replace(/[&]/g, 'and').toLowerCase();
	}
	function isConflictExists(conflictArray, faction1, faction2) {
		const normalizedFaction1 = normalizeFactionName(faction1);
		const normalizedFaction2 = normalizeFactionName(faction2);

		return conflictArray.some(conflict => 
			(normalizeFactionName(conflict.faction1) === normalizedFaction1 && normalizeFactionName(conflict.faction2) === normalizedFaction2) ||
			(normalizeFactionName(conflict.faction1) === normalizedFaction2 && normalizeFactionName(conflict.faction2) === normalizedFaction1)
		);
	}
	system.conflictsData.forEach(conflictData => {
		const faction1Name = conflictData.faction1.name;
		const faction2Name = conflictData.faction2.name;
		const faction1_won = conflictData.faction1.days_won;
		const faction2_won = conflictData.faction2.days_won;
		const faction1_stake = conflictData.faction1.stake;
		const faction2_stake = conflictData.faction2.stake;
		const faction1Data = system.othersData.find(systemFaction =>
			systemFaction.factions.some(faction => faction.factionName === faction1Name)
		);
		const faction2Data = system.othersData.find(systemFaction =>
			systemFaction.factions.some(faction => faction.factionName === faction2Name)
		);
		if (faction1Data && faction2Data) {
			let conflictObj = {
				faction1: faction1Name,
				faction2: faction2Name,
				faction1_days_won: faction1_won,
				faction2_days_won: faction2_won,
				faction1_stake: faction1_stake,
				faction2_stake: faction2_stake
			};
			if (!isConflictExists(conflictResults, faction1Name, faction2Name)) {
				conflictResults.push(conflictObj);
			}
		} else {
			console.log(`No data for faction: ${faction1Name} or ${faction2Name}`);
		}
	});
	return conflictResults.map(conflict => ({
		faction1: conflict.faction1,
		faction2: conflict.faction2,
		faction1_days_won: conflict.faction1_days_won,
		faction2_days_won: conflict.faction2_days_won,
		faction1_stake: conflict.faction1_stake,
		faction2_stake: conflict.faction2_stake
	}));
}

function getFactionStake(factionName, conflicts) {
	const conflict = conflicts.find(conflict => 
		conflict.faction1 === factionName || conflict.faction2 === factionName
	);
	if (conflict) {
		if (conflict.faction1 === factionName) {
			return conflict.faction1_stake !== '' ? conflict.faction1_stake : '- - -';
		} 
		else if (conflict.faction2 === factionName) {
			return conflict.faction2_stake !== '' ? conflict.faction2_stake : '- - -';
		}
	}
	return '';
}

function createSubRow(system, row) {
	let factionRows = [];
	const subRow = document.createElement('tr');
	subRow.style.display = 'none';
	subRow.classList.add('sub-row');
	const tableContainer = document.createElement('td');
	tableContainer.setAttribute('colspan', '16');
	tableContainer.style.padding = '0';
	tableContainer.style.border = 'none';
	const table = document.createElement('table');
	table.classList.add('sub-table');
	const headerRow = document.createElement('tr');
	headerRow.classList.add('sub-header-row');
	const conflicts = extractConflicts(system);
	const { peaceAgreement, deadFactions, noContact } = factionStatus;
	headerRow.innerHTML = `
		<td>Faction</td>
		<td subData-index="30">Influence</td>
		<td subData-index="31">Happiness</td>
		<td subData-index="32">Pending</td>
		<td subData-index="33">Active</td>
		<td subData-index="34">Recovery</td>
		<td subData-index="35">Allegiance</td>
		<td subData-index="36">Government</td>
		<td subData-index="37" class="tooltip" colspan="${conflicts.length > 0 ? conflicts.length : 1}">Conflicts
			<span class="tooltiptext">Days won</span>
		</td>
		<td subData-index="38">Stake</td>
		<td subData-index="39">Stations</td>
		<td subData-index="40">Controlling</td>
	`;
	table.appendChild(headerRow);
	if (Array.isArray(system.othersData) && system.othersData.length > 0) {
		let anyFactionData = false;
		system.othersData.forEach(systemFaction => {
			systemFaction.factions.forEach(factionData => {
				if (factionData.data && factionData.data.length > 0) {
					anyFactionData = true;
					let controlling = false;
					let home = false;
					let factionInfluenceClass = '';
					let factionClass = '';
					if (peaceAgreement.includes(factionData.factionName)) {
						factionClass = 'fac-peace-agreement';
					} else if (deadFactions.includes(factionData.factionName)) {
						factionClass = 'fac-dead-factions';
					} else if (noContact.includes(factionData.factionName)) {
						factionClass = 'fac-no-contact';
					} else if (factionData.data[0].playerFaction) {
						factionClass = 'fac-player-faction';
					}
					if (factionData.factionName.trim().toLowerCase() === system.controlling.trim().toLowerCase()) {
						controlling = true;
					}
					const factionDetails = factionData.data[0];
					if (factionDetails.playerFactionHome === system.name) {
						home = true;
					}
					const selectedFactionInfluence = parseFloat(system.influence);
					const factionInfluence = parseFloat(factionData.data[0].influence) || 0;
					if (factionData.factionName === selectedFaction) {
						if (system.influenceColor === 1) {
							factionInfluenceClass = 'influence-yellow';
						} else if (system.influenceColor === 2) {
							factionInfluenceClass = 'influence-red';
						}
					} else {
						const influenceDifference = Math.abs(selectedFactionInfluence - factionInfluence);
						if (influenceDifference < 5) {
							factionInfluenceClass = 'influence-red';
						} else if (influenceDifference < 10) {
							factionInfluenceClass = 'influence-yellow';
						} else {
							factionInfluenceClass = '';
						}
					}
					const row = document.createElement('tr');
					row.classList.add('sub-data-row');
					let conflictData = "";
					if (conflicts.length === 0) {
						conflictData = `<td>&nbsp;</td>`;
					} else {
						conflicts.forEach(conflict => {
							if (conflict.faction1 === factionData.factionName || conflict.faction2 === factionData.factionName) {
								let result = "0";
								if (conflict.faction1 === factionData.factionName) {
									result = conflict.faction1_days_won;
								} else if (conflict.faction2 === factionData.factionName) {
									result = conflict.faction2_days_won;
								}
								conflictData += `<td subData-index="37" class="tooltip">${result}
									<span class="tooltiptext">Days won</span>
								</td>`;
							} else {
								conflictData += `<td subData-index="37">&nbsp;</td>`;
							}
						});
					}
					const copyIcon = `<img src="pic/copy.png" alt="Copy Icon" class="copy-icon-2" data-faction-name="${factionData.factionName}">`;
					row.innerHTML = `
						<td class="faction-name-cell"><a class="${factionClass}" style="cursor: pointer;" data-faction="${factionData.factionName}">
							${factionData.factionName}${home ? ' <span style="color: #5BAD99;">[N]</span>' : ''}
							</a>
							${copyIcon}
						</td>
						<td subData-index="30" class="${factionInfluenceClass}">${factionDetails.influence}</td>
						<td subData-index="31">${factionDetails.happiness}</td>
						<td subData-index="32">${factionDetails.pending_states}</td>
						<td subData-index="33">${factionDetails.active_states}</td>
						<td subData-index="34">${factionDetails.recovering_states}</td>
						<td subData-index="35">${factionDetails.allegiance}</td>
						<td subData-index="36">${factionDetails.government}</td>
						${conflictData}
						<td subData-index="38">${getFactionStake(factionData.factionName, conflicts)}</td>
						<td subData-index="39">${factionDetails.factionStations}</td>
						<td subData-index="40" class="${controlling ? 'checked' : 'unchecked'}">
							${controlling ? '✔' : ''}
						</td>
					`;
					factionRows.push({
						row: row,
						influence: parseFloat(factionDetails.influence) || 0
					});
					factionRows.sort((a, b) => b.influence - a.influence);
					factionRows.forEach(factionRow => {
						table.appendChild(factionRow.row);
					});
					const factionCell = row.querySelector('td a[data-faction]');
					factionCell.addEventListener('click', function(event) {
						const factionName = event.target.dataset.faction;
						if (!savedFactions.includes(factionName)) {
							savedFactions.push(factionName);
							updateFactionSelect();
						}
						selectedFaction = factionName;
						const factionSelect = document.getElementById("factionSelect");
						factionSelect.value = factionName;
						localStorage.setItem('savedFactions', JSON.stringify(savedFactions));

						onStart();
					});
					const copyIcons = row.querySelectorAll('.copy-icon-2');
					copyIcons.forEach(icon => {
						icon.addEventListener('click', (event) => {
							const factionName = icon.getAttribute('data-faction-name');
							copyFactionNameToClipboard(event, factionName, icon);
						});
					});
				}
			});
		});
		if (!anyFactionData) {
			const emptyRow = document.createElement('tr');
			emptyRow.innerHTML = `
				<td colspan="4">No other factions in the system</td>
			`;
			table.appendChild(emptyRow);
		}
	} else {
		const emptyRow = document.createElement('tr');
		emptyRow.innerHTML = `
			<td colspan="4">No other factions in the system</td>
		`;
		table.appendChild(emptyRow);
	}
	tableContainer.appendChild(table);
	subRow.appendChild(tableContainer);
	row.subRow = subRow;
	if (!row.hasClickListener) {
		row.addEventListener('click', function(event) {
			const checkboxCell = event.target.closest('td');
			const checkbox = checkboxCell && checkboxCell.querySelector('input[type="checkbox"]');
			const link = event.target.closest('a.system-link');
			if (checkbox || link) {
				return;
			}
			toggleSubRow(row);
		});
		row.hasClickListener = true;
	}
	return subRow;
}

function toggleSubRow(row) {
	const subRow = row.subRow;
	if (subRow.style.display === 'none') {
		subRow.style.display = '';
	} else {
		subRow.style.display = 'none';
	}
}

function addSubRows() {
	const rows = document.querySelectorAll('tr.main-row');
	rows.forEach(row => {
		const system = row.system;
		const subRow = createSubRow(system, row);
		if (row.subRow) {
			row.subRow.remove();
		}
		row.parentNode.insertBefore(subRow, row.nextSibling);
		row.subRow = subRow;
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

function factionRaport() {
	document.getElementById('pageInfoContainer').style.display = 'none';
	const factionInfoOutput = document.getElementById('factionInfoOutput');
	checkLocalStorageForData();
	const { peaceAgreement, deadFactions, noContact } = factionStatus;
	const selectedFactionName = selectedFaction;
	let factionData = {};
	factionSystems.forEach(system => {
		system.othersData.forEach(data => {
			data.factions.forEach(faction => {
				if (faction.data[0] && faction.data[0].playerFaction && faction.factionName !== selectedFactionName) {
					if (!factionData[faction.factionName]) {
						factionData[faction.factionName] = {
							systemCount: 0,
							systemNames: [],
							factionClass: ''
						};
					}
					if (!factionData[faction.factionName].systemNames.includes(system.name)) {
						factionData[faction.factionName].systemNames.push(system.name);
					}
					factionData[faction.factionName].systemCount++;
					if (peaceAgreement.includes(faction.factionName)) {
						factionData[faction.factionName].factionClass = 'peace-agreement';
					} else if (noContact.includes(faction.factionName)) {
						factionData[faction.factionName].factionClass = 'no-contact';
					} else if (deadFactions.includes(faction.factionName)) {
						factionData[faction.factionName].factionClass = 'dead-factions';
					}
				}
			});
		});
	});
	let factionList = Object.keys(factionData).map(factionName => {
		return {
			factionName: factionName,
			systemCount: factionData[factionName].systemCount,
			systemNames: factionData[factionName].systemNames,
			factionClass: factionData[factionName].factionClass
		};
	});
	factionList.sort((a, b) => b.systemCount - a.systemCount);
	let tableHTML = `
		<table class="faction-table">
			<thead>
				<p style="color: #EF7B04; font-size: 20px;">Other player factions present in the systems</p>
				<tr>
					<th>#</th>
					<th>Faction</th>
					<th>Systems</th>
					<th> </th>
				</tr>
			</thead>
			<tbody>
	`;
	factionList.forEach((faction, index) => {
		const copyIcon = `<img
			src="pic/copy.png"
			alt="Copy Icon"
			class="copy-icon"
			data-faction-name="${faction.factionName}"
		>`;
		tableHTML += `
			<tr class="faction-row ${faction.factionClass}" data-faction="${faction.factionName}">
				<td>${index + 1}</td>
				<td>${faction.factionName}</td>
				<td>${faction.systemCount}</td>
				<td class="copy-icon-container">${copyIcon}</td>
			</tr>
			<tr class="system-names-row" data-faction="${faction.factionName}" style="display: none;">
				<td colspan="4">
					<ul>
						${faction.systemNames.map(system => `<li>${system}</li>`).join('')}
					</ul>
				</td>
			</tr>
		`;
	});

	tableHTML += `
			</tbody>
		</table>
	`;
	document.getElementById('factionInfoContainer').style.display = 'block';
	factionInfoOutput.innerHTML = tableHTML;
	const copyIcons = document.querySelectorAll('.copy-icon');
	copyIcons.forEach(icon => {
		icon.addEventListener('click', (event) => {
			const factionName = icon.getAttribute('data-faction-name');
			copyFactionNameToClipboard(event, factionName, icon);
		});
	});
	const factionRows = document.querySelectorAll('.faction-row');
	factionRows.forEach(row => {
		row.addEventListener('click', (event) => {
			if (event.target.closest('.copy-icon-container')) {
				return;
			}
			const factionName = row.getAttribute('data-faction');
			const systemRow = document.querySelector(`.system-names-row[data-faction="${factionName}"]`);
			if (systemRow.style.display === 'none') {
				systemRow.style.display = 'table-row';
			} else {
				systemRow.style.display = 'none';
			}
		});
	});
}

function copyFactionNameToClipboard(event, factionName, copyIcon) {
	event.stopPropagation();
	const textToCopy = factionName;
	const tempInput = document.createElement('input');
	tempInput.value = textToCopy;
	document.body.appendChild(tempInput);
	tempInput.select();
	document.execCommand('copy');
	document.body.removeChild(tempInput);
	copyIcon.src = 'pic/copy_red.png';
	setTimeout(() => {
		copyIcon.src = 'pic/copy.png';
	}, 500);
}

function info() {
	fetchData('GetInfo', {})
		.then(data => {
			const infoOutput = document.getElementById('infoOutput');
			if (!infoOutput) {
				console.error('Container for info output not found!');
				return;
			}
			let htmlContent = `
				<p style="
					color: ${data.style.description?.color || 'black'};
					text-align: ${data.style.description?.textAlign || 'center'};
					font-size: ${data.style.description?.fontSize || '18px'};
				">${data.description}</p>
				<ul>`;

			// "list1"
			htmlContent += `<h3 style="
				color: ${data.title1Style?.color || 'black'};
				text-align: ${data.title1Style?.textAlign || 'center'};
				font-size: ${data.title1Style?.fontSize || '20px'};
			">${data.title1}</h3>
			<ul>`;
			data.list1.forEach(item => {
				let itemStyle = item.style ? `
					color: ${item.style.color || 'black'};
					font-size: ${item.style['font-size'] || '16px'};
					text-align: ${item.style['text-align'] || 'left'};
					font-weight: ${item.style['font-weight'] || 'normal'};
				` : '';
				let subTextStyle = item.subText && item.subText.style ? `
					color: ${item.subText.style.color || 'blue'};
					font-size: ${item.subText.style['font-size'] || '14px'};
					text-align: ${item.subText.style['text-align'] || 'center'};
				` : '';
				let bulletStyle = subTextStyle ? subTextStyle : itemStyle;
				if (item.subText) {
					htmlContent += `
						<li style="${bulletStyle}">
							<span style="${itemStyle}">${item.text}</span> 
							<span style="${subTextStyle}">${item.subText.text}</span>
						</li>
					`;
				} else {
					htmlContent += `<li style="${itemStyle}">${item.text}</li>`;
				}
			});
			htmlContent += `
			</ul>`;

			// "list2"
			htmlContent += `<h3 style="
				color: ${data.title2Style?.color || 'black'};
				text-align: ${data.title2Style?.textAlign || 'center'};
				font-size: ${data.title2Style?.fontSize || '20px'};
			">${data.title2}</h3>
			<ul>`;
			data.list2.forEach(item => {
				let itemStyle = item.style ? `
					color: ${item.style.color || 'black'};
					font-size: ${item.style['font-size'] || '16px'};
					text-align: ${item.style['text-align'] || 'left'};
				` : '';
				let subTextStyle = item.subText && item.subText.style ? `
					color: ${item.subText.style.color || 'blue'};
					font-size: ${item.subText.style['font-size'] || '14px'};
					text-align: ${item.subText.style['text-align'] || 'center'};
				` : '';
				let bulletStyle = subTextStyle ? subTextStyle : itemStyle;
				if (item.subText) {
					htmlContent += `
						<li style="${bulletStyle}">
							<span style="${itemStyle}">${item.text}</span>
							<span style="${subTextStyle}">${item.subText.text}</span>
						</li>
					`;
				} else {
					htmlContent += `<li style="${itemStyle}">${item.text}</li>`;
				}
			});
			htmlContent += `
			</ul>`;
			
			// "list3"
			htmlContent += `<h3 style="
				color: ${data.title3Style?.color || 'black'};
				text-align: ${data.title3Style?.textAlign || 'center'};
				font-size: ${data.title3Style?.fontSize || '20px'};
			">${data.title3}</h3>
			<ul>`;
			data.list3.forEach(item => {
				let itemStyle = item.style ? `
					color: ${item.style.color || 'black'};
					font-size: ${item.style['font-size'] || '16px'};
					text-align: ${item.style['text-align'] || 'left'};
				` : '';
				let subTextStyle = item.subText && item.subText.style ? `
					color: ${item.subText.style.color || 'blue'};
					font-size: ${item.subText.style['font-size'] || '14px'};
					text-align: ${item.subText.style['text-align'] || 'center'};
				` : '';
				let bulletStyle = subTextStyle ? subTextStyle : itemStyle;
				if (item.subText) {
					htmlContent += `
						<li style="${bulletStyle}">
							<span style="${itemStyle}">${item.text}</span>
							<span style="${subTextStyle}">${item.subText.text}</span>
						</li>
					`;
				} else {
					htmlContent += `<li style="${itemStyle}">${item.text}</li>`;
				}
			});
			htmlContent += `
			</ul>`;
			infoOutput.innerHTML = htmlContent;
			document.getElementById('pageInfoContainer').style.display = 'block';
		})
		.catch(error => {
			console.error('Error loading the info.json file:', error);
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

// Display route and distances in output container
function displayRoute(systems) {
	const routeContainer = document.getElementById('routeOutput');
	if (!routeContainer) {
		console.error('Container for route output not found!');
		return;
	}
	const outputTable = document.createElement('table');
	outputTable.classList.add('route-table');
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
		distanceCell.textContent = distance.toFixed(0) + " Ly";
	});
	const totalDistanceRow = outputTable.insertRow();
	totalDistanceRow.innerHTML = `
		<td><strong>Total Distance</strong></td>
		<td><strong>${totalDistance.toFixed(0)}</strong> Ly</td>
	`;
	const headers = outputTable.querySelectorAll('th');
	headers.forEach(header => {
		header.removeAttribute('onclick');
	});
	routeContainer.innerHTML = '';
	routeContainer.appendChild(outputTable);
	document.getElementById('routeOutputContainer').style.display = 'block';
}

// Copy system name to clipboard and highlight icon
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
			selectedFaction = factionSelect.value;
			if (selectedFaction === "startFaction") {
				selectedFaction = "Canonn";
			}
			onStart();
		}
	}
	if (event.target === otherFactionInput && event.key === "Enter") {
		let enteredFaction = otherFactionInput.value;
		if (enteredFaction.length > 0) {
			if (!savedFactions.includes(enteredFaction)) {
				savedFactions.push(enteredFaction);
				updateFactionSelect();
				localStorage.setItem('savedFactions', JSON.stringify(savedFactions));
			}
			selectedFaction = enteredFaction;
			factionSelect.value = enteredFaction; 
			otherFactionInput.style.display = "none";
			onStart();
		} else {
			otherFactionInput.style.display = "none";
		}
	}
}

function updateFactionSelect() {
	const factionSelect = document.getElementById("factionSelect");
	savedFactions.forEach(faction => {
		const existingOption = Array.from(factionSelect.options).find(option => option.value === faction);
		if (!existingOption) {
			let option = document.createElement("option");
			option.value = faction;
			option.textContent = faction;
			factionSelect.appendChild(option);
		}
	});
	const startFactionOption = factionSelect.querySelector('option[value="startFaction"]');
	if (startFactionOption) {
		startFactionOption.style.display = "none";
	}
}

// "select/deselect all" button click to toggle checkboxes
function selectAll() {
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
}

function toggleDropdown() {
	const dropdownContent = document.querySelector(".dropdown-content");
	if (dropdownContent.style.display === "block") {
		dropdownContent.style.display = "none";
	} else {
		dropdownContent.style.display = "block";
	}
}

function toggleColumnVisibility() {
	const checkboxes = document.querySelectorAll("#columnsMenu .dropdown-content input[type='checkbox']");
	const selectedValues = Array.from(checkboxes)
		.filter(checkbox => checkbox.checked)
		.map(checkbox => checkbox.value);
	localStorage.setItem("selectedColumns", JSON.stringify(selectedValues));
	const mainColumns = document.querySelectorAll("#systemsTable th[data-index], #systemsTable td[data-index]");
	mainColumns.forEach((column) => {
		const columnIndex = column.getAttribute("data-index");
		if (selectedValues.includes(columnIndex)) {
			column.style.display = "";
		} else {
			column.style.display = "none";
		}
	});
	const subColumns = document.querySelectorAll("#systemsTable th[subData-index], #systemsTable td[subData-index]");
	subColumns.forEach((column) => {
		const columnIndex = column.getAttribute("subData-index");
		if (selectedValues.includes(columnIndex)) {
			column.style.display = "";
		} else {
			column.style.display = "none";
		}
	});
}

function loadColumnVisibility() {
	const savedColumns = JSON.parse(localStorage.getItem("selectedColumns")) || [];
	const defaultColumns = savedColumns && savedColumns.length > 0 ? savedColumns : ["3", "5", "14", "16", "18", "19", "20", "22", "23", "24", "30", "32", "33", "34", "37", "38", "39", "40"];
	const checkboxes = document.querySelectorAll("#columnsMenu .dropdown-content input[type='checkbox']");
	checkboxes.forEach(checkbox => {
		if (defaultColumns.includes(checkbox.value)) {
			checkbox.checked = true;
		} else {
			checkbox.checked = false;
		}
	});
	toggleColumnVisibility();
}

// Event listeners for website
document.getElementById('systemsTable').addEventListener('click', async function(event) {
	if (event.target && event.target.matches('a.system-link')) {
		const systemName = event.target.textContent.trim();
		const websiteFilterValue = document.getElementById('websiteFilter').value;
		const system = factionSystems.find(s => s.name === systemName);
		if (!system) {
			console.error('System not found!');
			return;
		}
		const params = {
			systemName: systemName,
			websiteFilterValue: websiteFilterValue,
			elitebgs_id: system.elitebgs_id,
			id64: system.id64
		};
		try {
			const url = await fetchSystemUrl(params);
			if (url) {
				window.open(url, '_blank');
			} else {
				console.error('Failed to generate URL.');
			}
		} catch (error) {
			console.error('Error generating URL:', error);
		}
	}
});

document.addEventListener('click', function(event) {
	var otherFactionInput = document.getElementById("otherFactionInput");
	var factionSelect = document.getElementById("factionSelect");
	if (!otherFactionInput.contains(event.target) && !factionSelect.contains(event.target)) {
		otherFactionInput.style.display = "none";
		updateFactionSelect();
	}
	var columnsMenu = document.getElementById("columnsMenu");
	var dropdownContent = columnsMenu.querySelector(".dropdown-content");
	var dropdownBtn = columnsMenu.querySelector(".dropdown-btn");
	if (!columnsMenu.contains(event.target)) {
		dropdownContent.style.display = "none";
	}
});

const elementsWithClickListeners = [
	{ id: 'downloadCSVBtn', action: () => generateCSV(orderedSystems) },
	{ id: 'reloadBtn', action: () => loadAndProcessData() },
	{ id: 'infoBtn', action: () => info() },
	{ id: 'raportBtn', action: () => factionRaport() },
	{ id: 'closeRouteBtn', action: () => document.getElementById('routeOutputContainer').style.display = 'none' },
	{ id: 'closeInfoBtn', action: () => document.getElementById('pageInfoContainer').style.display = 'none' },
	{ id: 'closeFactionBtn', action: () => document.getElementById('factionInfoContainer').style.display = 'none' },
	{ id: 'clearListBtn', action: () => clearFactionData("list") },
	{ id: 'clearDataBtn', action: () => clearFactionData("data") },
	{ id: 'routeBtn', action: () => plotRoute() }
];

elementsWithClickListeners.forEach(element => {
	document.getElementById(element.id).addEventListener('click', element.action);
});

document.getElementById('startSystemSelect').addEventListener('change', function(e) {
	selectedStartSystem = e.target.value;
});

document.getElementById('factionSelect').addEventListener('change', handleFactionChange);
document.getElementById('otherFactionInput').addEventListener('keydown', handleFactionChange);

window.onload = onStart;

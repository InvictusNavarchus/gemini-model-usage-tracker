// ==UserScript==
// @name         Gemini Model Usage Tracker (Daily/Calendar)
// @namespace    http://tampermonkey.net/
// @version      0.4.1
// @description  Tracks usage count for different Gemini AI models per day (US Pacific Time) with a calendar selector, modern UI, and editing capabilities (locked by Developer Mode).
// @author       InvictusNavarchus (modified by AI)
// @match        https://gemini.google.com/*
// @icon         https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_getResourceText
// @require      https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// @require      https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js
// @resource     flatpickrCSS https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css
// @resource     flatpickrTheme https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/themes/dark.css
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY_DAILY = 'geminiModelUsageCountsDaily'; // Changed key for new structure
    const UI_VISIBLE_KEY = 'geminiModelUsageUIVisible';
    const DEV_MODE_KEY = 'geminiTrackerDevModeEnabled';
    const PACIFIC_TIMEZONE = 'America/Los_Angeles';

    let selectedDate = getCurrentPacificDateString(); // Initialize with today's PT date

    // --- Model Definitions ---
    const modelNames = {
        '2.5 Pro': '2.5 Pro',
        'Deep Research': 'Deep Research',
        '2.0 Flash Thinking': '2.0 Flash Thinking',
        '2.0 Flash': '2.0 Flash',
        // Add more specific model names as they appear in the UI
    };

    // --- Helper Functions ---

    /**
     * Gets the current date string (YYYY-MM-DD) in US Pacific Time.
     * @returns {string} Date string or throws error if formatting fails.
     */
    function getCurrentPacificDateString() {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-CA', { // 'en-CA' gives YYYY-MM-DD
                timeZone: PACIFIC_TIMEZONE,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            return formatter.format(now);
        } catch (e) {
            console.error("Gemini Tracker: Error getting Pacific Time date.", e);
            // Fallback to local date (less ideal but prevents complete failure)
             const today = new Date();
             const yyyy = today.getFullYear();
             const mm = String(today.getMonth() + 1).padStart(2, '0');
             const dd = String(today.getDate()).padStart(2, '0');
             console.warn("Gemini Tracker: Falling back to local date string.");
             return `${yyyy}-${mm}-${dd}`;
        }
    }

    // Add specific function to track Deep Research confirmations
    function trackDeepResearchConfirmation() {
        document.body.addEventListener('click', function(event) {
            // Look for the "Start research" button using the data-test-id attribute
            const confirmButton = event.target.closest('button[data-test-id="confirm-button"]');
            if (confirmButton) {
                // When the button is clicked, increment the count for Deep Research model
                console.log("Gemini Tracker: Deep Research confirmation detected. Incrementing count for 'Deep Research'");
                incrementCount('Deep Research'); // This handles date logic internally
            }
        }, true); // Use capture phase
        console.log("Gemini Tracker: Deep Research confirmation listener attached to body.");
    }

    function loadAllCounts() {
        const storedData = GM_getValue(STORAGE_KEY_DAILY, '{}');
        try {
            const allCounts = JSON.parse(storedData);
            // Basic validation (ensure it's an object)
            if (typeof allCounts !== 'object' || allCounts === null) {
                console.warn("Gemini Tracker: Stored data is not an object, resetting.");
                return {};
            }
            // Optional: Deeper validation per date entry if needed
             Object.keys(allCounts).forEach(dateKey => {
                 if (typeof allCounts[dateKey] !== 'object' || allCounts[dateKey] === null) {
                     console.warn(`Gemini Tracker: Invalid data for date ${dateKey}, removing.`);
                     delete allCounts[dateKey];
                     return;
                 }
                 Object.keys(allCounts[dateKey]).forEach(modelKey => {
                     if (typeof allCounts[dateKey][modelKey] !== 'number' || isNaN(allCounts[dateKey][modelKey])) {
                         console.warn(`Gemini Tracker: Invalid count for ${modelKey} on ${dateKey}, resetting to 0.`);
                         allCounts[dateKey][modelKey] = 0;
                     }
                 });
             });

            return allCounts;
        } catch (e) {
            console.error("Gemini Tracker: Error parsing stored daily counts.", e);
            return {}; // Return empty object on error
        }
    }

    function getCountsForDate(dateString) {
        const allCounts = loadAllCounts();
        const dailyCounts = allCounts[dateString] || {};
        // Ensure all defined models have a 0 entry for the requested day if not present
        Object.values(modelNames).forEach(name => {
            if (!(name in dailyCounts)) {
                dailyCounts[name] = 0;
            }
        });
        return dailyCounts;
    }

    function saveAllCounts(allCounts) {
        // Add validation before saving if desired (e.g., ensure counts are numbers)
        try {
            GM_setValue(STORAGE_KEY_DAILY, JSON.stringify(allCounts));
        } catch (e) {
             console.error("Gemini Tracker: Error saving daily counts.", e);
        }
    }

   function getCurrentModelName() {
        // Try finding the model name using the data-test-id first (more stable)
        const modelElement = document.querySelector('bard-mode-switcher [data-test-id="attribution-text"] span');
        let rawText = null;

        if (modelElement && modelElement.textContent) {
            rawText = modelElement.textContent.trim();
        } else {
            // Fallback selector (less reliable, might change)
            const fallbackElement = document.querySelector('.current-mode-title span');
             if (fallbackElement && fallbackElement.textContent) {
                 rawText = fallbackElement.textContent.trim();
             }
        }

        if (rawText) {
            // Sort keys by length descending to match longest first
            const sortedKeys = Object.keys(modelNames).sort((a, b) => b.length - a.length);

            for (const key of sortedKeys) {
                if (rawText.startsWith(key)) {
                    return modelNames[key]; // Return the standardized name for the longest match
                }
            }
             // Fallback if no specific match startsWith, maybe it's a new model
             console.log(`Gemini Tracker: Model text "${rawText}" didn't match known prefixes, using raw text.`);
             return rawText; // Return the raw text as a potential new model name
         }

        console.warn("Gemini Tracker: Could not determine current model name.");
        return null; // Indicate failure to find the model
    }

    function incrementCount(modelName) {
        if (!modelName) return;

        const currentPTDate = getCurrentPacificDateString();
        const allCounts = loadAllCounts();

        // Ensure the object for the current date exists
        if (!allCounts[currentPTDate]) {
            allCounts[currentPTDate] = {};
        }

        const dailyCounts = allCounts[currentPTDate];

        if (dailyCounts.hasOwnProperty(modelName)) {
            dailyCounts[modelName] = (dailyCounts[modelName] || 0) + 1;
        } else {
            // If it's a newly detected model name (returned as rawText), add it
            console.log(`Gemini Tracker: Detected new model '${modelName}' on ${currentPTDate}, adding to tracker.`);
            dailyCounts[modelName] = 1;
            // Manually add to `modelNames` constant if it becomes permanent
        }

        saveAllCounts(allCounts);

        // Only update UI if it's visible AND showing the current PT date
        if (uiPanel && uiPanel.style.display === 'block' && selectedDate === currentPTDate) {
            updateUI(selectedDate);
        }
    }

    function manuallySetCount(modelName, newCount, dateStringToModify) {
        const parsedCount = parseInt(newCount, 10);
        if (modelName && !isNaN(parsedCount) && parsedCount >= 0 && dateStringToModify) {
            console.log(`Gemini Tracker: Manually setting count for ${modelName} on ${dateStringToModify} to ${parsedCount}`);
            const allCounts = loadAllCounts();

            // Ensure the object for the target date exists
            if (!allCounts[dateStringToModify]) {
                allCounts[dateStringToModify] = {};
            }

            allCounts[dateStringToModify][modelName] = parsedCount;
            saveAllCounts(allCounts);
            updateUI(dateStringToModify); // Update UI for the date that was modified
            return true; // Indicate success
        } else {
            console.warn(`Gemini Tracker: Invalid count value "${newCount}" or missing data for model ${modelName} on date ${dateStringToModify}. Must be a non-negative number.`);
            // Revert the input field by re-rendering the UI for the selected date
            updateUI(selectedDate);
            return false; // Indicate failure
        }
    }

    // Reset counts ONLY for the currently selected date
    function resetCountsForSelectedDate() {
        if (confirm(`Are you sure you want to reset all Gemini model usage counts for ${selectedDate}?`)) {
            const allCounts = loadAllCounts();
            if (allCounts[selectedDate]) {
                console.log(`Gemini Tracker: Resetting counts for ${selectedDate}.`);
                // Clear the counts for the selected date by assigning an empty object
                allCounts[selectedDate] = {};
                // Or optionally, set all known models to 0 for that date:
                // allCounts[selectedDate] = {};
                // Object.values(modelNames).forEach(name => { allCounts[selectedDate][name] = 0; });

                saveAllCounts(allCounts);
                updateUI(selectedDate); // Refresh UI for the cleared date
            } else {
                 console.log(`Gemini Tracker: No counts found for ${selectedDate} to reset.`);
            }
        }
    }

    // --- UI Creation and Management ---

    let uiPanel = null;
    let toggleButton = null;
    let devModeCheckbox = null;
    let datePickerInput = null;
    let flatpickrInstance = null;

    function createUI() {
        // Inject flatpickr CSS
        const flatpickrStyles = GM_getResourceText("flatpickrCSS");
        const flatpickrThemeStyles = GM_getResourceText("flatpickrTheme");
        GM_addStyle(flatpickrStyles);
        GM_addStyle(flatpickrThemeStyles);

        // Toggle Button
        toggleButton = document.createElement('div');
        toggleButton.id = 'gemini-tracker-toggle';
        // SVG icon remains the same
         toggleButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF">
                <path d="M0 0h24v24H0V0z" fill="none"/>
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
        `;
        toggleButton.title = "Show/Hide Gemini Usage Stats";
        document.body.appendChild(toggleButton);

        // Stats Panel Structure
        uiPanel = document.createElement('div');
        uiPanel.id = 'gemini-tracker-panel';
        uiPanel.innerHTML = `
            <div class="tracker-header">
                <h3>Model Usage</h3>
                 <div class="tracker-date-selector-container">
                    <input type="text" id="tracker-date-selector" placeholder="Select Date">
                 </div>
                <button id="tracker-close-btn" title="Close">&times;</button>
            </div>
            <ul id="tracker-list"></ul>
            <div class="tracker-separator"></div>
            <div class="tracker-separator"></div>
             <button id="tracker-reset-btn" title="Reset counts for selected date">Reset Counts for Day</button>
        `;
        document.body.appendChild(uiPanel);

        // --- Date Picker Initialization ---
         datePickerInput = uiPanel.querySelector('#tracker-date-selector');
         flatpickrInstance = flatpickr(datePickerInput, {
             dateFormat: "Y-m-d",
             defaultDate: selectedDate, // Set initial date
             maxDate: getCurrentPacificDateString(), // Optional: prevent future dates?
             altInput: true, // Show user-friendly format, submit standard format
             altFormat: "M j, Y", // Example: Mar 31, 2025
             onChange: function(selectedDates, dateStr, instance) {
                 console.log("Selected date:", dateStr);
                 selectedDate = dateStr; // Update global selected date
                 updateUI(selectedDate); // Refresh the list for the new date
             },
         });


        // --- Create and Insert Developer Mode Toggle ---
        const devModeContainer = document.createElement('div');
        devModeContainer.className = 'tracker-setting';
        // ... (rest of dev mode element creation is the same as before) ...
         const devModeLabel = document.createElement('label');
        devModeLabel.htmlFor = 'dev-mode-checkbox';
        devModeLabel.textContent = 'Developer Mode';

        const devModeToggle = document.createElement('label');
        devModeToggle.className = 'switch';

        devModeCheckbox = document.createElement('input'); // Assign to global ref
        devModeCheckbox.type = 'checkbox';
        devModeCheckbox.id = 'dev-mode-checkbox';

        const slider = document.createElement('span');
        slider.className = 'slider round';

        devModeToggle.appendChild(devModeCheckbox);
        devModeToggle.appendChild(slider);

        devModeContainer.appendChild(devModeLabel);
        devModeContainer.appendChild(devModeToggle);

        // Insert Dev Mode *before* the second separator
        const resetButton = uiPanel.querySelector('#tracker-reset-btn');
        const secondSeparator = resetButton.previousElementSibling; // The separator before reset
        secondSeparator.parentNode.insertBefore(devModeContainer, secondSeparator);


        // --- Event Listeners ---
        toggleButton.addEventListener('click', toggleUIVisibility);
        uiPanel.querySelector('#tracker-close-btn').addEventListener('click', () => setUIVisibility(false));
        // Reset button now resets for the selected date
        uiPanel.querySelector('#tracker-reset-btn').addEventListener('click', resetCountsForSelectedDate);
        devModeCheckbox.addEventListener('change', handleDevModeToggle);

        // Edit listener remains largely the same, but passes selectedDate to save function
        uiPanel.querySelector('#tracker-list').addEventListener('click', (event) => {
            const isDevModeEnabled = GM_getValue(DEV_MODE_KEY, false);
            if (isDevModeEnabled && event.target.classList.contains('model-count') && !event.target.isEditing) {
                makeCountEditable(event.target);
            } else if (!isDevModeEnabled && event.target.classList.contains('model-count')) {
                 console.log("Gemini Tracker: Editing disabled. Enable Developer Mode to edit counts.");
            }
        });

        // --- Initial State ---
        const isVisible = GM_getValue(UI_VISIBLE_KEY, false);
        setUIVisibility(isVisible); // Set initial panel visibility

        const initialDevMode = GM_getValue(DEV_MODE_KEY, false);
        updateDevModeVisuals(initialDevMode); // Set initial dev mode visuals

        // Populate with counts for the initially selected date
        updateUI(selectedDate);
    }

     function setUIVisibility(visible) {
        if (!uiPanel || !toggleButton) return;
        uiPanel.style.display = visible ? 'block' : 'none';
        toggleButton.classList.toggle('active', visible);
        document.body.classList.toggle('gemini-tracker-panel-open', visible);
        GM_setValue(UI_VISIBLE_KEY, visible);
    }

    function toggleUIVisibility() {
        if (!uiPanel) return;
        const currentlyVisible = uiPanel.style.display === 'block';
        setUIVisibility(!currentlyVisible);
         if (!currentlyVisible) {
            // When opening, refresh UI for the currently selected date
            selectedDate = flatpickrInstance ? flatpickrInstance.selectedDates[0] ? flatpickrInstance.formatDate(flatpickrInstance.selectedDates[0], "Y-m-d") : getCurrentPacificDateString() : getCurrentPacificDateString(); // Ensure selectedDate is current
            if(flatpickrInstance && !flatpickrInstance.selectedDates[0]){
                 flatpickrInstance.setDate(selectedDate, false); // Update calendar if it lost selection
            }
            const currentDevMode = GM_getValue(DEV_MODE_KEY, false);
            updateDevModeVisuals(currentDevMode); // Ensure dev mode visuals are correct
            updateUI(selectedDate); // Refresh content for the selected date
        }
    }

    // --- Handle Developer Mode Toggle Change ---
     function handleDevModeToggle() {
        const isEnabled = devModeCheckbox.checked;
        GM_setValue(DEV_MODE_KEY, isEnabled);
        console.log(`Gemini Tracker: Developer Mode ${isEnabled ? 'Enabled' : 'Disabled'}`);
        updateDevModeVisuals(isEnabled);
        // Re-render the list for the selected date to apply/remove tooltips etc.
        updateUI(selectedDate);
    }

    // --- Update Visuals Based on Dev Mode State ---
    function updateDevModeVisuals(isEnabled) {
        if (devModeCheckbox) {
            devModeCheckbox.checked = isEnabled;
        }
        if (uiPanel) {
            uiPanel.classList.toggle('dev-mode-active', isEnabled);
        }
         // Styling changes handled by CSS based on 'dev-mode-active' class
    }


    function updateUI(dateString) {
         if (!uiPanel) return;
        const listElement = uiPanel.querySelector('#tracker-list');
        if (!listElement) return;

        // Ensure the calendar input reflects the date being displayed
        if (flatpickrInstance && datePickerInput.value !== dateString) {
             // Update flatpickr's internal date without triggering onChange
             flatpickrInstance.setDate(dateString, false);
        }

        const countsForDay = getCountsForDate(dateString);

        // Clear previous entries
        listElement.innerHTML = '';

        const isDevModeEnabled = GM_getValue(DEV_MODE_KEY, false);

         // Get potentially new models detected on this day + defined models
         let modelsToDisplay = [...Object.values(modelNames)];
         Object.keys(countsForDay).forEach(model => {
             if (!modelsToDisplay.includes(model)) {
                 modelsToDisplay.push(model);
             }
         });
         // Sort: Defined models first alphabetically, then new models alphabetically
         modelsToDisplay.sort((a, b) => {
             const aIsKnown = Object.values(modelNames).includes(a);
             const bIsKnown = Object.values(modelNames).includes(b);
             if (aIsKnown && !bIsKnown) return -1;
             if (!aIsKnown && bIsKnown) return 1;
             return a.localeCompare(b);
         });


        let hasUsage = false;
        for (const modelName of modelsToDisplay) {
            const count = countsForDay[modelName] || 0; // Get count, default to 0 if not present
             if (count > 0) hasUsage = true;

            const listItem = document.createElement('li');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'model-name';
            nameSpan.textContent = modelName;
            nameSpan.title = modelName;

            const countSpan = document.createElement('span');
            countSpan.className = 'model-count';
            countSpan.textContent = count;
            countSpan.dataset.modelName = modelName; // Store model name for editing

            if (isDevModeEnabled) {
                countSpan.title = 'Click to edit';
            } else {
                countSpan.title = ''; // No tooltip when not editable
            }

            listItem.appendChild(nameSpan);
            listItem.appendChild(countSpan);
            listElement.appendChild(listItem);
        }

         // Add a message if the list is empty or all counts are zero for the day
         if (modelsToDisplay.length === 0 || !hasUsage) {
              const emptyItem = document.createElement('li');
              emptyItem.textContent = `No usage tracked for ${dateString}.`;
              emptyItem.style.fontStyle = 'italic';
              emptyItem.style.opacity = '0.7';
              emptyItem.style.justifyContent = 'center'; // Center the empty message
              listElement.appendChild(emptyItem);
         }
    }

    // --- Editing Input Field Logic ---
    function makeCountEditable(countSpan) {
        countSpan.isEditing = true; // Prevent re-clicks
        const currentCount = countSpan.textContent;
        const modelName = countSpan.dataset.modelName;

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'edit-count-input';
        input.value = currentCount;
        input.min = "0";
        input.setAttribute('aria-label', `Edit count for ${modelName} on ${selectedDate}`);

        countSpan.style.display = 'none';
        countSpan.parentNode.insertBefore(input, countSpan.nextSibling);
        input.focus();
        input.select();

        const removeInput = (saveValue) => {
             if (!document.body.contains(input)) return; // Already removed

             // Find the parent li in case we need to restore the span manually
             const parentListItem = input.closest('li');

            if (saveValue) {
                // Pass the currently selectedDate to the save function
                manuallySetCount(modelName, input.value, selectedDate);
                 // manuallySetCount calls updateUI, so no need to restore span locally
            } else {
                 // Cancel: Remove input, show original span
                input.remove();
                if(parentListItem) {
                     // Find the original span within this specific list item
                    const originalSpan = parentListItem.querySelector(`.model-count[data-model-name="${modelName}"]`);
                    if(originalSpan) {
                        originalSpan.style.display = ''; // Restore visibility
                        originalSpan.isEditing = false; // Reset editing flag
                    }
                }
            }
             // Reset flag in case of cancel/blur without save
             // (It's implicitly reset by updateUI on successful save)
            if (!saveValue && countSpan) countSpan.isEditing = false;
        };

         input.addEventListener('blur', () => {
            if (!input.enterPressed) { // Avoid double save on Enter + Blur
                 // Slight delay allows Enter keydown to process first if needed
                 setTimeout(() => removeInput(true), 50);
             }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.enterPressed = true; // Flag to prevent blur event saving again
                removeInput(true); // Save on Enter
            } else if (e.key === 'Escape') {
                 input.enterPressed = false; // Ensure blur doesn't save if Escape is hit
                removeInput(false); // Cancel on Escape
            }
        });
    }


    // --- Styling ---
    GM_addStyle(`
        /* --- Base Styles (Panel, Toggle, Header, List, Reset) --- */
        #gemini-tracker-toggle { /* Styles unchanged */
            position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px;
            background-color: #1a73e8; color: white; border-radius: 50%; display: flex;
            justify-content: center; align-items: center; cursor: pointer;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); z-index: 9998;
            transition: background-color 0.3s ease, transform 0.3s ease;
        }
        #gemini-tracker-toggle:hover { background-color: #1765cc; transform: scale(1.1); }
        #gemini-tracker-panel { /* Adjust width slightly for date picker */
            position: fixed; bottom: 80px; right: 20px; width: 320px; max-height: 450px; /* Increased width/height */
            overflow-y: auto; background-color: rgba(40, 40, 45, 0.95); color: #e8eaed;
            border-radius: 12px; box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3); z-index: 9999;
            padding: 15px; display: none; font-family: 'Google Sans', sans-serif;
            backdrop-filter: blur(5px); border: 1px solid rgba(255, 255, 255, 0.1);
        }
        #gemini-tracker-panel::-webkit-scrollbar { width: 8px; }
        #gemini-tracker-panel::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
        #gemini-tracker-panel::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.3); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }
        #gemini-tracker-panel::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.5); }
        .tracker-header { /* Align items for date picker */
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 10px; padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
            gap: 10px; /* Add some space between header items */
        }
        .tracker-header h3 { margin: 0; font-size: 1.1em; font-weight: 500; color: #bdc1c6; flex-shrink: 0; }

         /* --- Date Picker Styles --- */
         .tracker-date-selector-container {
             flex-grow: 1; /* Allow it to take available space */
             text-align: center; /* Center the input */
         }
        #tracker-date-selector { /* Style the flatpickr input */
            background-color: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: #e8eaed;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 0.9em;
            font-family: inherit;
             text-align: center;
             cursor: pointer;
             min-width: 120px; /* Ensure it has some minimum width */
         }
         #tracker-date-selector:focus {
             outline: none;
             border-color: #8ab4f8;
             background-color: rgba(255, 255, 255, 0.15);
         }
         /* Flatpickr calendar theming is handled by the dark theme CSS */


        #tracker-close-btn { /* Styles unchanged */
             background: none; border: none; color: #bdc1c6; font-size: 24px; line-height: 1;
             cursor: pointer; padding: 0 5px; opacity: 0.7; transition: opacity 0.2s ease;
             flex-shrink: 0; /* Prevent shrinking */
        }
        #tracker-close-btn:hover { color: #e8eaed; opacity: 1; }
        #tracker-list { list-style: none; padding: 0; margin: 10px 0 0 0; } /* Add margin top */
        #tracker-list li { /* Styles unchanged */
             display: flex; justify-content: space-between; align-items: center; padding: 8px 5px;
             border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.95em; min-height: 28px;
        }
        #tracker-list li:last-child { border-bottom: none; }
        .model-name { /* Styles unchanged */
             flex-grow: 1; margin-right: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .model-count { /* Base style - no cursor/hover by default */
            font-weight: 600; min-width: 40px; text-align: right; color: #8ab4f8;
             padding: 2px 4px; border-radius: 4px; transition: background-color 0.2s ease;
        }
        .edit-count-input { /* Styles unchanged */
            font-family: 'Google Sans', sans-serif; font-size: 0.9em; font-weight: 600;
            color: #e8eaed; background-color: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; width: 50px;
            text-align: right; padding: 2px 4px; margin-left: auto; box-sizing: border-box;
            -moz-appearance: textfield;
        }
        .edit-count-input::-webkit-outer-spin-button,
        .edit-count-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .edit-count-input:focus { outline: none; border-color: #8ab4f8; background-color: rgba(255, 255, 255, 0.15); }
         #tracker-reset-btn { /* Styles unchanged, but functionality changed */
             display: block; width: 100%; padding: 8px 12px; background-color: rgba(217, 48, 37, 0.8);
             color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em;
             font-weight: 500; text-align: center; transition: background-color 0.2s ease; margin-top: 15px;
         }
         #tracker-reset-btn:hover { background-color: rgba(217, 48, 37, 1); }

        /* --- Separator Line --- */
        .tracker-separator { /* Styles unchanged */
            height: 1px;
            background-color: rgba(255, 255, 255, 0.15);
            margin: 15px 0; /* Space above and below */
        }

        /* --- Developer Mode Setting Row --- */
        .tracker-setting { /* Styles unchanged */
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
             /* margin-bottom: 10px; */ /* Removed bottom margin as separator handles spacing */
             font-size: 0.95em;
             color: #bdc1c6;
        }
        .tracker-setting label[for="dev-mode-checkbox"] { cursor: default; }

        /* --- Toggle Switch Styles --- */
        .switch { /* Styles unchanged */
            position: relative; display: inline-block; width: 40px; height: 20px; margin-left: 10px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(255, 255, 255, 0.2); transition: .4s; }
        .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px;
            bottom: 3px; background-color: white; transition: .4s; }
        input:checked + .slider { background-color: #8ab4f8; }
        input:focus + .slider { box-shadow: 0 0 1px #8ab4f8; }
        input:checked + .slider:before { transform: translateX(20px); }
        .slider.round { border-radius: 20px; }
        .slider.round:before { border-radius: 50%; }

        /* --- Conditional Styling Based on Panel Class --- */
        #gemini-tracker-panel.dev-mode-active .model-count { cursor: pointer; }
        #gemini-tracker-panel.dev-mode-active .model-count:hover {
             background-color: rgba(138, 180, 248, 0.2); }

        /* --- Body Class --- */
        body.gemini-tracker-panel-open input-area-v2 { /* Styles unchanged */ }

        /* --- Flatpickr Dark Theme Adjustments (Optional) --- */
        .flatpickr-calendar.dark {
             background: rgba(50, 50, 55, 0.98); /* Slightly adjusted background */
             border-radius: 8px;
             box-shadow: 0 4px 15px rgba(0,0,0,0.4);
             border: 1px solid rgba(255, 255, 255, 0.15);
             backdrop-filter: blur(4px);
         }
         .flatpickr-calendar.dark .flatpickr-day:hover,
         .flatpickr-calendar.dark .flatpickr-day.prevMonthDay:hover,
         .flatpickr-calendar.dark .flatpickr-day.nextMonthDay:hover {
             background: rgba(138, 180, 248, 0.2); /* Use highlight color for hover */
         }
        .flatpickr-calendar.dark .flatpickr-day.selected {
             background: #8ab4f8; /* Match UI highlight */
             border-color: #8ab4f8;
         }
          .flatpickr-calendar.dark .flatpickr-day.today {
              border-color: rgba(255, 255, 255, 0.5); /* Make today indicator visible */
          }
          .flatpickr-calendar.dark .flatpickr-day.today:hover {
               background: rgba(138, 180, 248, 0.2); /* Use highlight hover */
           }
          .flatpickr-calendar.dark .flatpickr-months .flatpickr-prev-month,
          .flatpickr-calendar.dark .flatpickr-months .flatpickr-next-month {
              fill: #bdc1c6; /* Adjust arrow color */
          }
           .flatpickr-calendar.dark .flatpickr-months .flatpickr-prev-month:hover svg,
           .flatpickr-calendar.dark .flatpickr-months .flatpickr-next-month:hover svg {
               fill: #e8eaed; /* Brighter arrow on hover */
           }
           .flatpickr-calendar.dark .flatpickr-current-month .flatpickr-monthDropdown-months,
           .flatpickr-calendar.dark .flatpickr-current-month input.cur-year {
                color: #e8eaed; /* Header text color */
                font-weight: 500;
           }
    `);

    // --- Event Listener for Prompt Submission ---
    function attachSendListener() {
        document.body.addEventListener('click', function(event) {
            const sendButton = event.target.closest('button:has(mat-icon[data-mat-icon-name="send"]), button.send-button');
            if (sendButton && sendButton.getAttribute('aria-disabled') !== 'true') {
                 setTimeout(() => {
                     const modelName = getCurrentModelName();
                     console.log(`Gemini Tracker: Send clicked. Current model: ${modelName || 'Unknown'}. Incrementing for PT Date: ${getCurrentPacificDateString()}`);
                     incrementCount(modelName); // This now handles date logic internally
                 }, 50);
            }
        }, true); // Use capture phase
         console.log("Gemini Tracker: Send button listener attached to body.");
    }

    // --- Initialization ---
    VM.observe(document.body, () => {
        const chatContainer = document.querySelector('chat-window');
        const inputArea = document.querySelector('input-area-v2');

        if (chatContainer && inputArea && !document.getElementById('gemini-tracker-toggle')) {
            console.log("Gemini Tracker: Initializing UI, listeners, and calendar.");
            // Ensure selectedDate is the current PT date before creating UI
             selectedDate = getCurrentPacificDateString();
            createUI(); // Creates panel, toggle, calendar, loads initial states
            attachSendListener();
            trackDeepResearchConfirmation(); // Add Deep Research tracking
            // Add menu commands (Reset now targets selected date)
            GM_registerMenuCommand("Reset Gemini Counts for Selected Day", resetCountsForSelectedDate);
            GM_registerMenuCommand("Toggle Gemini Usage UI", toggleUIVisibility);
            return true; // Stop observing
        }
        return false; // Continue observing
    });

})();
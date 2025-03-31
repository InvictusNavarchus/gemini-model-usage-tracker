// ==UserScript==
// @name         Gemini Model Usage Tracker
// @namespace    http://tampermonkey.net/
// @version      0.3.0
// @description  Tracks usage count for different Gemini AI models with a modern UI, editing capabilities (locked by Developer Mode).
// @author       InvictusNavarchus
// @match        https://gemini.google.com/*
// @icon         https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @require      https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'geminiModelUsageCounts';
    const UI_VISIBLE_KEY = 'geminiModelUsageUIVisible';
    const DEV_MODE_KEY = 'geminiTrackerDevModeEnabled';

    // --- Model Definitions ---
    const modelNames = {
        '2.5 Pro': '2.5 Pro',
        'Deep Research': 'Deep Research',
        '2.0 Flash Thinking': '2.0 Flash Thinking',
        '2.0 Flash': '2.0 Flash',
        // Add more specific model names as they appear in the UI
    };

    // --- Helper Functions ---

    function loadCounts() {
        const storedData = GM_getValue(STORAGE_KEY, '{}');
        try {
            const counts = JSON.parse(storedData);
            // Ensure all defined models have an entry
            Object.values(modelNames).forEach(name => {
                if (!(name in counts)) {
                    counts[name] = 0;
                }
            });
            // Ensure all stored keys are numbers (fix potential past errors)
            for (const key in counts) {
                if (typeof counts[key] !== 'number' || isNaN(counts[key])) {
                     console.warn(`Gemini Tracker: Invalid count found for ${key}, resetting to 0.`);
                    counts[key] = 0;
                }
            }
            return counts;
        } catch (e) {
            console.error("Gemini Tracker: Error parsing stored counts.", e);
            // Initialize with zeros if parsing fails
             const initialCounts = {};
             Object.values(modelNames).forEach(name => { initialCounts[name] = 0; });
            return initialCounts;
        }
    }

    function saveCounts(counts) {
        // Ensure all counts are valid numbers before saving
        const validCounts = {};
        for (const key in counts) {
             const count = parseInt(counts[key], 10);
             validCounts[key] = (!isNaN(count) && count >= 0) ? count : 0;
        }
        GM_setValue(STORAGE_KEY, JSON.stringify(validCounts));
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

        const counts = loadCounts();
        if (counts.hasOwnProperty(modelName)) {
            counts[modelName] = (counts[modelName] || 0) + 1;
        } else {
            // If it's a newly detected model name (returned as rawText), add it
            console.log(`Gemini Tracker: Detected new model '${modelName}', adding to tracker.`);
            counts[modelName] = 1;
            // You might want to manually add this new name to the `modelNames` const
            // in the script for future consistency if it appears often.
        }
        saveCounts(counts);
        // Only update UI if it's currently visible to avoid unnecessary redraws
        if (uiPanel && uiPanel.style.display === 'block') {
             updateUI(counts);
        }
    }

    function manuallySetCount(modelName, newCount) {
        const parsedCount = parseInt(newCount, 10);
        if (modelName && !isNaN(parsedCount) && parsedCount >= 0) {
            console.log(`Gemini Tracker: Manually setting count for ${modelName} to ${parsedCount}`);
            const counts = loadCounts();
            counts[modelName] = parsedCount;
            saveCounts(counts);
            updateUI(counts); // Update UI immediately after manual save
            return true; // Indicate success
        } else {
            console.warn(`Gemini Tracker: Invalid count value "${newCount}" for model ${modelName}. Must be a non-negative number.`);
            // Revert the input field if validation fails by re-rendering
             updateUI(loadCounts());
            return false; // Indicate failure
        }
    }

    function resetCounts() {
        if (confirm('Are you sure you want to reset all Gemini model usage counts?')) {
            const initialCounts = {};
             Object.values(modelNames).forEach(name => { initialCounts[name] = 0; });
             // Keep potentially newly discovered models but reset their count
             const currentCounts = loadCounts();
             Object.keys(currentCounts).forEach(key => {
                 if (!initialCounts.hasOwnProperty(key)) { initialCounts[key] = 0; }
             });
            saveCounts(initialCounts);
            updateUI(initialCounts);
            console.log("Gemini Tracker: Counts reset.");
        }
    }


    // --- UI Creation and Management ---

    let uiPanel = null;
    let toggleButton = null;
    let devModeCheckbox = null; // Reference to the dev mode checkbox

    function createUI() {
        // Toggle Button (Floating Action Button)
        toggleButton = document.createElement('div');
        toggleButton.id = 'gemini-tracker-toggle';
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
        // Use programmatic creation for better control
        uiPanel.innerHTML = `
            <div class="tracker-header">
                <h3>Model Usage</h3>
                <button id="tracker-close-btn" title="Close">&times;</button>
            </div>
            <ul id="tracker-list"></ul>
            <div class="tracker-separator"></div>
            <button id="tracker-reset-btn" title="Reset all counts">Reset Counts</button>
        `;
        document.body.appendChild(uiPanel);

        // --- Create and Insert Developer Mode Toggle ---
        const devModeContainer = document.createElement('div');
        devModeContainer.className = 'tracker-setting';

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

        // Insert before the reset button
        const resetButton = uiPanel.querySelector('#tracker-reset-btn');
        resetButton.parentNode.insertBefore(devModeContainer, resetButton);


        // --- Event Listeners ---
        toggleButton.addEventListener('click', toggleUIVisibility);
        uiPanel.querySelector('#tracker-close-btn').addEventListener('click', () => setUIVisibility(false));
        uiPanel.querySelector('#tracker-reset-btn').addEventListener('click', resetCounts);

        // Listener for Developer Mode Toggle changes
        devModeCheckbox.addEventListener('change', handleDevModeToggle);

        // Listener for potential edits (checks dev mode)
        uiPanel.querySelector('#tracker-list').addEventListener('click', (event) => {
            // Check Dev Mode Status Before Allowing Edit
            const isDevModeEnabled = GM_getValue(DEV_MODE_KEY, false);
            if (isDevModeEnabled && event.target.classList.contains('model-count') && !event.target.isEditing) {
                makeCountEditable(event.target);
            } else if (!isDevModeEnabled && event.target.classList.contains('model-count')) {
                 console.log("Gemini Tracker: Editing disabled. Enable Developer Mode to edit counts.");
                 // Optional: Show a brief tooltip/message indicating why it's disabled
            }
        });

        // --- Initial State ---
        const isVisible = GM_getValue(UI_VISIBLE_KEY, false);
        // Set initial visibility
        setUIVisibility(isVisible);

        // Load and apply initial Dev Mode state *before* the first updateUI call
        const initialDevMode = GM_getValue(DEV_MODE_KEY, false);
        // Set checkbox state and panel class
        updateDevModeVisuals(initialDevMode);

        // Populate with counts respecting initial Dev Mode state
        updateUI(loadCounts());
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
            // Refresh UI content fully when opening, respecting current dev mode
            const currentDevMode = GM_getValue(DEV_MODE_KEY, false);
            // Ensure panel class is correct
            updateDevModeVisuals(currentDevMode);
            updateUI(loadCounts());
        }
    }

    // --- Handle Developer Mode Toggle Change ---
     function handleDevModeToggle() {
        const isEnabled = devModeCheckbox.checked;
        GM_setValue(DEV_MODE_KEY, isEnabled);
        console.log(`Gemini Tracker: Developer Mode ${isEnabled ? 'Enabled' : 'Disabled'}`);
        updateDevModeVisuals(isEnabled);
        // Re-render the list to apply/remove tooltips etc.
        updateUI(loadCounts());
    }

    // --- Update Visuals Based on Dev Mode State ---
    function updateDevModeVisuals(isEnabled) {
        if (devModeCheckbox) {
            devModeCheckbox.checked = isEnabled;
        }
        if (uiPanel) {
            uiPanel.classList.toggle('dev-mode-active', isEnabled);
        }
         // Note: Styling changes (cursor, hover, tooltips) are handled
         // by CSS rules based on 'dev-mode-active' class and logic within updateUI.
    }


    function updateUI(counts) {
         if (!uiPanel) return;
        const listElement = uiPanel.querySelector('#tracker-list');
        if (!listElement) return;

        // Clear previous entries
        listElement.innerHTML = '';

        // Determine current dev mode state ONCE for efficiency
        const isDevModeEnabled = GM_getValue(DEV_MODE_KEY, false);

        const sortedModelNames = Object.keys(counts).sort((a, b) => {
            const aIsKnown = Object.values(modelNames).includes(a);
            const bIsKnown = Object.values(modelNames).includes(b);
            if (aIsKnown && !bIsKnown) return -1; // Known models first
            if (!aIsKnown && bIsKnown) return 1;
             // Then sort alphabetically
            return a.localeCompare(b);
        });


        for (const modelName of sortedModelNames) {
            const count = counts[modelName];
            const listItem = document.createElement('li');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'model-name';
            nameSpan.textContent = modelName;
            nameSpan.title = modelName; // Show full name on hover if truncated

            const countSpan = document.createElement('span');
            // Base class
            countSpan.className = 'model-count';
            countSpan.textContent = count;
            countSpan.dataset.modelName = modelName; // Store model name for editing

            // Conditionally add tooltip based on Dev Mode
            if (isDevModeEnabled) {
                countSpan.title = 'Click to edit';
            } else {
                // No tooltip when not editable
                countSpan.title = '';
            }

            listItem.appendChild(nameSpan);
            listItem.appendChild(countSpan);
            listElement.appendChild(listItem);
        }

         // Add a message if the list is empty
         if (sortedModelNames.length === 0 || sortedModelNames.every(name => counts[name] === 0)) {
              const emptyItem = document.createElement('li');
              emptyItem.textContent = 'No usage tracked yet.';
              emptyItem.style.fontStyle = 'italic';
              emptyItem.style.opacity = '0.7';
              // Center the empty message
              emptyItem.style.justifyContent = 'center';
              listElement.appendChild(emptyItem);
         }
    }

    // --- Editing Input Field Logic ---
    function makeCountEditable(countSpan) {
        // Flag to prevent rapid re-clicks triggering multiple inputs
        countSpan.isEditing = true;
        const currentCount = countSpan.textContent;
        const modelName = countSpan.dataset.modelName;

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'edit-count-input';
        input.value = currentCount;
        input.min = "0"; // Ensure non-negative input
        input.setAttribute('aria-label', `Edit count for ${modelName}`);

        // Replace span with input
        countSpan.style.display = 'none';
        countSpan.parentNode.insertBefore(input, countSpan.nextSibling);
        input.focus();
        input.select();

        // Event listeners for the input
        const removeInput = (saveValue) => {
             // Ensure we don't try to act on removed elements
             if (!document.body.contains(input)) return;

             // Find the parent li in case we need to restore the span manually
             const parentListItem = input.closest('li');

            if (saveValue) {
                // This triggers updateUI, which redraws everything
                manuallySetCount(modelName, input.value);
            } else {
                // Cancel: Just remove input, show original span
                input.remove();
                if(parentListItem) {
                    const originalSpan = parentListItem.querySelector('.model-count[data-model-name="' + modelName + '"]');
                    if(originalSpan) {
                        originalSpan.style.display = '';
                        originalSpan.isEditing = false; // Reset editing flag
                    }
                }
                // No need to call updateUI on cancel, just restore the view locally.
            }
        };

        input.addEventListener('blur', () => {
             // Use a flag to prevent double execution if Enter caused the blur
            if (!input.enterPressed) {
                 // Add a tiny delay to allow 'Enter' keydown to process first if needed
                 setTimeout(() => removeInput(true), 50);
             }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                 // Prevent potential form submission
                e.preventDefault();
                 // Set flag to prevent blur event saving again
                 input.enterPressed = true;
                 // Save on Enter
                removeInput(true);
            } else if (e.key === 'Escape') {
                // Cancel on Escape
                removeInput(false);
            }
        });
    }


    // --- Styling ---
    GM_addStyle(`
        /* --- Base Styles (Panel, Toggle Button, Header, List, Reset) --- */
        #gemini-tracker-toggle {
            position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px;
            background-color: #1a73e8; color: white; border-radius: 50%; display: flex;
            justify-content: center; align-items: center; cursor: pointer;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); z-index: 9998;
            transition: background-color 0.3s ease, transform 0.3s ease;
        }
        #gemini-tracker-toggle:hover { background-color: #1765cc; transform: scale(1.1); }
        #gemini-tracker-panel {
            position: fixed; bottom: 80px; right: 20px; width: 280px; max-height: 400px;
            overflow-y: auto; background-color: rgba(40, 40, 45, 0.95); color: #e8eaed;
            border-radius: 12px; box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3); z-index: 9999;
            padding: 15px; display: none; font-family: 'Google Sans', sans-serif;
            backdrop-filter: blur(5px); border: 1px solid rgba(255, 255, 255, 0.1);
        }
        #gemini-tracker-panel::-webkit-scrollbar { width: 8px; }
        #gemini-tracker-panel::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
        #gemini-tracker-panel::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.3); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }
        #gemini-tracker-panel::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.5); }
        .tracker-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.15); padding-bottom: 10px;
        }
        .tracker-header h3 { margin: 0; font-size: 1.1em; font-weight: 500; color: #bdc1c6; }
        #tracker-close-btn {
             background: none; border: none; color: #bdc1c6; font-size: 24px; line-height: 1;
             cursor: pointer; padding: 0 5px; opacity: 0.7; transition: opacity 0.2s ease; }
        #tracker-close-btn:hover { color: #e8eaed; opacity: 1; }
        #tracker-list { list-style: none; padding: 0; margin: 0; }
        #tracker-list li {
             display: flex; justify-content: space-between; align-items: center; padding: 8px 5px;
             border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.95em; min-height: 28px;
        }
        #tracker-list li:last-child { border-bottom: none; }
        .model-name {
             flex-grow: 1; margin-right: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .model-count { /* Base style - no cursor/hover by default */
            font-weight: 600; min-width: 40px; text-align: right; color: #8ab4f8;
             padding: 2px 4px; border-radius: 4px; transition: background-color 0.2s ease;
             /* cursor: default; */ /* Explicitly default cursor */
        }
        .edit-count-input {
            font-family: 'Google Sans', sans-serif; font-size: 0.9em; font-weight: 600;
            color: #e8eaed; background-color: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; width: 50px;
            text-align: right; padding: 2px 4px; margin-left: auto; box-sizing: border-box;
            -moz-appearance: textfield; /* Hides spinner arrows in Firefox */
        }
        .edit-count-input::-webkit-outer-spin-button,
        .edit-count-input::-webkit-inner-spin-button { /* Hides spinner arrows in Chrome/Safari */
             -webkit-appearance: none; margin: 0;
        }
        .edit-count-input:focus { outline: none; border-color: #8ab4f8; background-color: rgba(255, 255, 255, 0.15); }
         #tracker-reset-btn {
             display: block; width: 100%; padding: 8px 12px; background-color: rgba(217, 48, 37, 0.8);
             color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em;
             font-weight: 500; text-align: center; transition: background-color 0.2s ease; margin-top: 15px;
         }
         #tracker-reset-btn:hover { background-color: rgba(217, 48, 37, 1); }


        /* --- Separator Line --- */
        .tracker-separator {
            height: 1px;
            background-color: rgba(255, 255, 255, 0.15);
            margin: 15px 0; /* Space above and below */
        }

        /* --- Developer Mode Setting Row --- */
        .tracker-setting {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0; /* Vertical padding */
             margin-bottom: 10px; /* Space before separator/reset button */
             font-size: 0.95em;
             color: #bdc1c6;
        }
        .tracker-setting label[for="dev-mode-checkbox"] {
            cursor: default; /* Label text shouldn't look clickable */
        }


        /* --- Toggle Switch Styles --- */
        .switch {
            position: relative;
            display: inline-block;
            width: 40px; /* Smaller width */
            height: 20px; /* Smaller height */
            margin-left: 10px; /* Space from label */
        }
        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 255, 255, 0.2); /* Off background */
            transition: .4s;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 14px; /* Smaller circle */
            width: 14px; /* Smaller circle */
            left: 3px; /* Adjust position */
            bottom: 3px; /* Adjust position */
            background-color: white;
            transition: .4s;
        }
        input:checked + .slider {
            background-color: #8ab4f8; /* Blue 'on' state */
        }
        input:focus + .slider {
            box-shadow: 0 0 1px #8ab4f8;
        }
        input:checked + .slider:before {
            transform: translateX(20px); /* Move circle across */
        }
        /* Rounded sliders */
        .slider.round {
            border-radius: 20px; /* Fully rounded */
        }
        .slider.round:before {
            border-radius: 50%;
        }

        /* --- Conditional Styling Based on Panel Class --- */
        #gemini-tracker-panel.dev-mode-active .model-count {
            cursor: pointer; /* Pointer only when dev mode is active */
        }
        #gemini-tracker-panel.dev-mode-active .model-count:hover {
             background-color: rgba(138, 180, 248, 0.2); /* Hover effect only when dev mode is active */
        }

        /* --- Body Class --- */
        body.gemini-tracker-panel-open input-area-v2 {
              /* Example: margin-right: 300px; */
              /* Be cautious with this, might interfere with site layout */
         }
    `);

    // --- Event Listener for Prompt Submission ---
    function attachSendListener() {
        // Use event delegation on the body for robustness
        document.body.addEventListener('click', function(event) {
            // Find the closest ancestor button that contains the send icon
            const sendButton = event.target.closest('button:has(mat-icon[data-mat-icon-name="send"]), button.send-button');

            if (sendButton && sendButton.getAttribute('aria-disabled') !== 'true') {
                 // Add a small delay to ensure the model name display might have updated
                 setTimeout(() => {
                     const modelName = getCurrentModelName();
                     console.log(`Gemini Tracker: Send clicked. Current model: ${modelName || 'Unknown'}`);
                     incrementCount(modelName);
                 }, 50); // 50ms delay, adjust if needed
            }
        }, true); // Use capture phase
         console.log("Gemini Tracker: Send button listener attached to body.");
    }

    // --- Initialization ---
    // Wait for the main chat app elements to likely be present
    VM.observe(document.body, () => {
        // Check if the main chat interface seems ready
        const chatContainer = document.querySelector('chat-window');
        // Use a specific element from the input area
        const inputArea = document.querySelector('input-area-v2');

        if (chatContainer && inputArea && !document.getElementById('gemini-tracker-toggle')) {
            console.log("Gemini Tracker: Initializing UI and listeners.");
            // Creates panel, toggle, loads initial states
            createUI();
            attachSendListener();
            // Add menu commands
            GM_registerMenuCommand("Reset Gemini Usage Counts", resetCounts);
            GM_registerMenuCommand("Toggle Gemini Usage UI", toggleUIVisibility);
            // Stop observing once initialized
            return true;
        }
        // Continue observing
        return false;
    });

})();
// ==UserScript==
// @name         Gemini Model Usage Tracker
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  Tracks usage count for different Gemini AI models with a modern UI and editing capabilities.
// @author       InvictusNavarchus (modified by AI)
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
             const initialCounts = {};
             Object.values(modelNames).forEach(name => {
                initialCounts[name] = 0;
            });
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
        const modelElement = document.querySelector('bard-mode-switcher [data-test-id="attribution-text"] span');
        let rawText = null;

        if (modelElement && modelElement.textContent) {
            rawText = modelElement.textContent.trim();
        } else {
            const fallbackElement = document.querySelector('.current-mode-title span');
             if (fallbackElement && fallbackElement.textContent) {
                 rawText = fallbackElement.textContent.trim();
             }
        }

        if (rawText) {
            const sortedKeys = Object.keys(modelNames).sort((a, b) => b.length - a.length);
            for (const key of sortedKeys) {
                if (rawText.startsWith(key)) {
                    return modelNames[key];
                }
            }
             console.log(`Gemini Tracker: Model text "${rawText}" didn't match known prefixes, using raw text.`);
             return rawText;
         }

        console.warn("Gemini Tracker: Could not determine current model name.");
        return null;
    }

    function incrementCount(modelName) {
        if (!modelName) return;

        const counts = loadCounts();
        if (counts.hasOwnProperty(modelName)) {
            counts[modelName] = (counts[modelName] || 0) + 1;
        } else {
            console.log(`Gemini Tracker: Detected new model '${modelName}', adding to tracker.`);
            counts[modelName] = 1;
        }
        saveCounts(counts);
        updateUI(counts);
    }

    // --- NEW: Function to handle manual count update ---
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
            // Optionally revert the input field if validation fails severely,
            // but blur/enter handling often re-renders anyway.
             updateUI(loadCounts()); // Re-render to show the previous valid count
            return false; // Indicate failure
        }
    }


    function resetCounts() {
        if (confirm('Are you sure you want to reset all Gemini model usage counts?')) {
            const initialCounts = {};
             Object.values(modelNames).forEach(name => {
                initialCounts[name] = 0;
            });
             const currentCounts = loadCounts();
             Object.keys(currentCounts).forEach(key => {
                 if (!initialCounts.hasOwnProperty(key)) {
                     initialCounts[key] = 0;
                 }
             });

            saveCounts(initialCounts);
            updateUI(initialCounts);
            console.log("Gemini Tracker: Counts reset.");
        }
    }


    // --- UI Creation and Management ---

    let uiPanel = null;
    let toggleButton = null;

    function createUI() {
        // Toggle Button (same as before)
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

        // Stats Panel (same structure as before)
        uiPanel = document.createElement('div');
        uiPanel.id = 'gemini-tracker-panel';
        uiPanel.innerHTML = `
            <div class="tracker-header">
                <h3>Model Usage</h3>
                <button id="tracker-close-btn" title="Close">&times;</button>
            </div>
            <ul id="tracker-list">
                </ul>
            <button id="tracker-reset-btn" title="Reset all counts">Reset Counts</button>
        `;
        document.body.appendChild(uiPanel);

        // Event Listeners (Reset and Close are the same)
        toggleButton.addEventListener('click', toggleUIVisibility);
        uiPanel.querySelector('#tracker-close-btn').addEventListener('click', () => setUIVisibility(false));
        uiPanel.querySelector('#tracker-reset-btn').addEventListener('click', resetCounts);

        // --- NEW: Event listener delegation for editing counts ---
        uiPanel.querySelector('#tracker-list').addEventListener('click', (event) => {
            if (event.target.classList.contains('model-count') && !event.target.isEditing) {
                makeCountEditable(event.target);
            }
        });

        const isVisible = GM_getValue(UI_VISIBLE_KEY, false);
        setUIVisibility(isVisible);
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
            updateUI(loadCounts()); // Refresh UI content when opening
        }
    }

    function updateUI(counts) {
         if (!uiPanel) return;
        const listElement = uiPanel.querySelector('#tracker-list');
        if (!listElement) return;

        listElement.innerHTML = ''; // Clear previous entries

        const sortedModelNames = Object.keys(counts).sort((a, b) => {
            const aIsKnown = Object.values(modelNames).includes(a);
            const bIsKnown = Object.values(modelNames).includes(b);
            if (aIsKnown && !bIsKnown) return -1;
            if (!aIsKnown && bIsKnown) return 1;
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
            countSpan.className = 'model-count';
            countSpan.textContent = count;
            countSpan.title = 'Click to edit'; // Add tooltip
            countSpan.dataset.modelName = modelName; // Store model name for editing

            listItem.appendChild(nameSpan);
            listItem.appendChild(countSpan);
            listElement.appendChild(listItem);
        }

         if (sortedModelNames.length === 0 || sortedModelNames.every(name => counts[name] === 0)) {
              const emptyItem = document.createElement('li');
              emptyItem.textContent = 'No usage tracked yet.';
              emptyItem.style.fontStyle = 'italic';
              emptyItem.style.opacity = '0.7';
               emptyItem.style.justifyContent = 'center'; // Center the empty message
              listElement.appendChild(emptyItem);
         }
    }

    // --- NEW: Functions to handle the editing input field ---
    function makeCountEditable(countSpan) {
        countSpan.isEditing = true; // Flag to prevent rapid re-clicks triggering multiple inputs
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

        // --- Event listeners for the input ---
        const removeInput = (saveValue) => {
            if (!document.body.contains(input)) return; // Avoid errors if already removed

            if (saveValue) {
                manuallySetCount(modelName, input.value); // This will re-render the UI via updateUI
            } else {
                 // Just revert visually without saving
                countSpan.style.display = ''; // Show original span
                 if (document.body.contains(input)) {
                    input.remove(); // Remove the input field
                 }
                countSpan.isEditing = false; // Reset editing flag
            }
             // Note: manuallySetCount calls updateUI, which rebuilds the list,
             // effectively removing the old input and span and recreating them.
             // If we didn't save, we restore the span manually above.
        };

        input.addEventListener('blur', () => {
             // Add a tiny delay to allow 'Enter' keydown to process first if needed
             setTimeout(() => removeInput(true), 50);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent potential form submission
                removeInput(true); // Save on Enter
            } else if (e.key === 'Escape') {
                removeInput(false); // Cancel on Escape
            }
        });
    }

    // --- Styling (Added .edit-count-input) ---
    GM_addStyle(`
        #gemini-tracker-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background-color: #1a73e8; /* Google Blue */
            color: white;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            z-index: 9998;
            transition: background-color 0.3s ease, transform 0.3s ease;
        }
        #gemini-tracker-toggle:hover {
            background-color: #1765cc; /* Darker Blue */
            transform: scale(1.1);
        }
         #gemini-tracker-toggle.active {}

        #gemini-tracker-panel {
            position: fixed;
            bottom: 80px; /* Position above the toggle button */
            right: 20px;
            width: 280px;
            max-height: 400px; /* Limit height */
            overflow-y: auto; /* Add scroll if content exceeds max-height */
            background-color: rgba(40, 40, 45, 0.95); /* Dark semi-transparent */
            color: #e8eaed; /* Light gray text */
            border-radius: 12px;
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            padding: 15px;
            display: none; /* Hidden by default */
            font-family: 'Google Sans', sans-serif; /* Consistent font */
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Scrollbar styling */
        #gemini-tracker-panel::-webkit-scrollbar { width: 8px; }
        #gemini-tracker-panel::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
        #gemini-tracker-panel::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.3); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }
        #gemini-tracker-panel::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.5); }

        .tracker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
            padding-bottom: 10px;
        }
        .tracker-header h3 { margin: 0; font-size: 1.1em; font-weight: 500; color: #bdc1c6; }
        #tracker-close-btn { background: none; border: none; color: #bdc1c6; font-size: 24px; line-height: 1; cursor: pointer; padding: 0 5px; opacity: 0.7; transition: opacity 0.2s ease; }
        #tracker-close-btn:hover { color: #e8eaed; opacity: 1; }

        #tracker-list { list-style: none; padding: 0; margin: 0 0 15px 0; }
        #tracker-list li { display: flex; justify-content: space-between; align-items: center; padding: 8px 5px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.95em; min-height: 28px; /* Ensure consistent height even with input */ }
        #tracker-list li:last-child { border-bottom: none; }
        .model-name { flex-grow: 1; margin-right: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .model-count {
            font-weight: 600;
            min-width: 40px; /* Slightly wider for input */
            text-align: right;
            color: #8ab4f8; /* Light blue for counts */
            cursor: pointer; /* Indicate clickability */
            padding: 2px 4px; /* Add some padding */
            border-radius: 4px; /* Slightly round edges */
            transition: background-color 0.2s ease;
        }
        .model-count:hover {
             background-color: rgba(138, 180, 248, 0.2); /* Subtle hover effect */
        }

        /* --- NEW: Styling for the edit input --- */
        .edit-count-input {
            font-family: 'Google Sans', sans-serif;
            font-size: 0.9em; /* Slightly smaller than count span */
            font-weight: 600;
            color: #e8eaed; /* Light text */
            background-color: rgba(255, 255, 255, 0.1); /* Slightly lighter background */
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            width: 50px; /* Fixed width */
            text-align: right;
            padding: 2px 4px;
             margin-left: auto; /* Push it to the right */
             box-sizing: border-box; /* Include padding/border in width */
             -moz-appearance: textfield; /* Hides spinner arrows in Firefox */
        }
         .edit-count-input::-webkit-outer-spin-button,
         .edit-count-input::-webkit-inner-spin-button { /* Hides spinner arrows in Chrome/Safari */
             -webkit-appearance: none;
             margin: 0;
         }
         .edit-count-input:focus {
             outline: none;
             border-color: #8ab4f8; /* Highlight focus */
             background-color: rgba(255, 255, 255, 0.15);
         }


         #tracker-reset-btn {
             display: block;
             width: 100%;
             padding: 8px 12px;
             background-color: rgba(217, 48, 37, 0.8);
             color: white;
             border: none;
             border-radius: 6px;
             cursor: pointer;
             font-size: 0.9em;
             font-weight: 500;
             text-align: center;
             transition: background-color 0.2s ease;
             margin-top: 10px;
         }
         #tracker-reset-btn:hover { background-color: rgba(217, 48, 37, 1); }

         body.gemini-tracker-panel-open input-area-v2 { }
    `);

    // --- Event Listener for Prompt Submission (same as before) ---

    function attachSendListener() {
        document.body.addEventListener('click', function(event) {
            const sendButton = event.target.closest('button:has(mat-icon[data-mat-icon-name="send"]), button.send-button');
            if (sendButton && sendButton.getAttribute('aria-disabled') !== 'true') {
                 setTimeout(() => {
                     const modelName = getCurrentModelName();
                     console.log(`Gemini Tracker: Send clicked. Current model: ${modelName || 'Unknown'}`);
                     incrementCount(modelName);
                 }, 50);
            }
        }, true);
         console.log("Gemini Tracker: Send button listener attached to body.");
    }

    // --- Initialization (same as before) ---
    VM.observe(document.body, () => {
        const chatContainer = document.querySelector('chat-window');
        const inputArea = document.querySelector('input-area-v2');

        if (chatContainer && inputArea && !document.getElementById('gemini-tracker-toggle')) {
            console.log("Gemini Tracker: Initializing UI and listeners.");
            createUI();
            attachSendListener();
            GM_registerMenuCommand("Reset Gemini Usage Counts", resetCounts);
            GM_registerMenuCommand("Toggle Gemini Usage UI", toggleUIVisibility);
            return true; // Stop observing
        }
        return false; // Continue observing
    });

})();
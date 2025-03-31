// ==UserScript==
// @name         Gemini Model Usage Tracker
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Tracks usage count for different Gemini AI models with a modern UI.
// @author       Your Name (or AI Assistant)
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
    // Keys should ideally match the start of the text found in the UI
    const modelNames = {
        '2.5 Pro': '2.5 Pro',
        'Deep Research': 'Deep Research',
        '2.0 Flash': '2.0 Flash',
        '2.0 Flash Thinking': '2.0 Flash Thinking',
        // Add more specific model names as they appear in the UI
        // Example: 'Gemini 1.5 Pro': 'Gemini 1.5 Pro',
        // If a model name includes extra text like "(experimental)",
        // the key here should be the base name for matching.
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
            return counts;
        } catch (e) {
            console.error("Gemini Tracker: Error parsing stored counts.", e);
            // Initialize with zeros if parsing fails
             const initialCounts = {};
             Object.values(modelNames).forEach(name => {
                initialCounts[name] = 0;
            });
            return initialCounts;
        }
    }

    function saveCounts(counts) {
        GM_setValue(STORAGE_KEY, JSON.stringify(counts));
    }

    function getCurrentModelName() {
        // Try finding the model name using the data-test-id first (more stable)
        const modelElement = document.querySelector('bard-mode-switcher [data-test-id="attribution-text"] span');
        if (modelElement && modelElement.textContent) {
            const rawText = modelElement.textContent.trim();
            // Find the best match from our defined modelNames
            for (const key in modelNames) {
                if (rawText.startsWith(key)) {
                    return modelNames[key]; // Return the standardized name
                }
            }
             // Fallback if no specific match startsWith, maybe it's an exact match or a new model
             if (rawText) return rawText; // Return the raw text as a potential new model
        }

        // Fallback selector (less reliable, might change)
        const fallbackElement = document.querySelector('.current-mode-title span');
         if (fallbackElement && fallbackElement.textContent) {
             const rawText = fallbackElement.textContent.trim();
             for (const key in modelNames) {
                 if (rawText.startsWith(key)) {
                     return modelNames[key];
                 }
             }
             if (rawText) return rawText;
         }

        console.warn("Gemini Tracker: Could not determine current model name.");
        return null; // Indicate failure to find the model
    }

    function incrementCount(modelName) {
        if (!modelName) return; // Don't increment if model name is unknown

        const counts = loadCounts();
        if (counts.hasOwnProperty(modelName)) {
            counts[modelName] = (counts[modelName] || 0) + 1;
        } else {
            // If it's a newly detected model name, add it
            console.log(`Gemini Tracker: Detected new model '${modelName}', adding to tracker.`);
            counts[modelName] = 1;
            // Optional: Automatically update modelNames if desired (more complex)
        }
        saveCounts(counts);
        updateUI(counts); // Update the UI immediately
    }

    function resetCounts() {
        if (confirm('Are you sure you want to reset all Gemini model usage counts?')) {
            const initialCounts = {};
             Object.values(modelNames).forEach(name => {
                initialCounts[name] = 0;
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
        // Toggle Button
        toggleButton = document.createElement('div');
        toggleButton.id = 'gemini-tracker-toggle';
        toggleButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF">
                <path d="M0 0h24v24H0V0z" fill="none"/>
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
        `; // Simple cloud upload icon, change as desired
        toggleButton.title = "Show/Hide Gemini Usage Stats";
        document.body.appendChild(toggleButton);

        // Stats Panel
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

        // Event Listeners
        toggleButton.addEventListener('click', toggleUIVisibility);
        uiPanel.querySelector('#tracker-close-btn').addEventListener('click', () => setUIVisibility(false));
        uiPanel.querySelector('#tracker-reset-btn').addEventListener('click', resetCounts);


        // Initial State
        const isVisible = GM_getValue(UI_VISIBLE_KEY, false);
        setUIVisibility(isVisible); // Set initial visibility from storage
        updateUI(loadCounts()); // Populate with initial counts
    }

     function setUIVisibility(visible) {
        if (!uiPanel || !toggleButton) return;
        uiPanel.style.display = visible ? 'block' : 'none';
        toggleButton.classList.toggle('active', visible);
        // Optionally add a class to the body when panel is open for more styling possibilities
        document.body.classList.toggle('gemini-tracker-panel-open', visible);
        GM_setValue(UI_VISIBLE_KEY, visible);
    }

    function toggleUIVisibility() {
        if (!uiPanel) return;
        const currentlyVisible = uiPanel.style.display === 'block';
        setUIVisibility(!currentlyVisible);
         if (!currentlyVisible) {
            // Refresh UI content when opening
            updateUI(loadCounts());
        }
    }


    function updateUI(counts) {
         if (!uiPanel) return; // Don't try to update if UI isn't created yet

        const listElement = uiPanel.querySelector('#tracker-list');
        if (!listElement) return;

        listElement.innerHTML = ''; // Clear previous entries

        // Sort model names for consistent display, potentially putting known ones first
        const sortedModelNames = Object.keys(counts).sort((a, b) => {
            const aIsKnown = Object.values(modelNames).includes(a);
            const bIsKnown = Object.values(modelNames).includes(b);
            if (aIsKnown && !bIsKnown) return -1;
            if (!aIsKnown && bIsKnown) return 1;
            return a.localeCompare(b); // Alphabetical sort otherwise
        });


        for (const modelName of sortedModelNames) {
            const count = counts[modelName];
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="model-name">${modelName}</span>
                <span class="model-count">${count}</span>
            `;
            listElement.appendChild(listItem);
        }
         // Add a message if the list is empty (e.g., after reset or initial load)
         if (sortedModelNames.length === 0) {
              const emptyItem = document.createElement('li');
              emptyItem.textContent = 'No usage tracked yet.';
              emptyItem.style.fontStyle = 'italic';
              listElement.appendChild(emptyItem);
         }
    }

    // --- Styling ---
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
         #gemini-tracker-toggle.active {
             /* Optional: Style differently when panel is open */
             /* background-color: #e84135; /* Google Red */
         }

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

        /* Scrollbar styling for webkit browsers */
        #gemini-tracker-panel::-webkit-scrollbar {
            width: 8px;
        }
        #gemini-tracker-panel::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }
        #gemini-tracker-panel::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            border: 2px solid transparent;
            background-clip: content-box;
        }
        #gemini-tracker-panel::-webkit-scrollbar-thumb:hover {
            background-color: rgba(255, 255, 255, 0.5);
        }


        .tracker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
            padding-bottom: 10px;
        }
        .tracker-header h3 {
            margin: 0;
            font-size: 1.1em;
            font-weight: 500;
            color: #bdc1c6; /* Slightly dimmer text for header */
        }
        #tracker-close-btn {
            background: none;
            border: none;
            color: #bdc1c6;
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
            padding: 0 5px;
             opacity: 0.7;
             transition: opacity 0.2s ease;
        }
        #tracker-close-btn:hover {
            color: #e8eaed;
             opacity: 1;
        }

        #tracker-list {
            list-style: none;
            padding: 0;
            margin: 0 0 15px 0; /* Space before reset button */
        }
        #tracker-list li {
            display: flex;
            justify-content: space-between;
            padding: 8px 5px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 0.95em;
        }
         #tracker-list li:last-child {
             border-bottom: none;
         }
        .model-name {
            flex-grow: 1;
            margin-right: 10px;
             white-space: nowrap;
             overflow: hidden;
             text-overflow: ellipsis;
        }
        .model-count {
            font-weight: 600;
            min-width: 30px; /* Ensure space for numbers */
            text-align: right;
            color: #8ab4f8; /* Light blue for counts */
        }

         #tracker-reset-btn {
             display: block;
             width: 100%;
             padding: 8px 12px;
             background-color: rgba(217, 48, 37, 0.8); /* Google Red, semi-transparent */
             color: white;
             border: none;
             border-radius: 6px;
             cursor: pointer;
             font-size: 0.9em;
             font-weight: 500;
             text-align: center;
             transition: background-color 0.2s ease;
             margin-top: 10px; /* Add space above the button */
         }
         #tracker-reset-btn:hover {
             background-color: rgba(217, 48, 37, 1); /* Solid Red on hover */
         }

         /* Adjust chat input area slightly if needed when panel is open */
         body.gemini-tracker-panel-open input-area-v2 {
              /* Example: margin-right: 300px; */
              /* Be cautious with this, might interfere with site layout */
         }
    `);

    // --- Event Listener for Prompt Submission ---

    function attachSendListener() {
        // Use event delegation on the body for robustness against dynamic element changes
        document.body.addEventListener('click', function(event) {
            // Find the closest ancestor button that contains the send icon
            // This handles clicks on the icon itself or the button padding
            const sendButton = event.target.closest('button:has(mat-icon[data-mat-icon-name="send"]), button.send-button');

            if (sendButton && sendButton.getAttribute('aria-disabled') !== 'true') {
                 // Check if the button is actually enabled
                 // Add a small delay to ensure the model name display might have updated if changed just before sending
                 setTimeout(() => {
                     const modelName = getCurrentModelName();
                     console.log(`Gemini Tracker: Send clicked. Current model: ${modelName || 'Unknown'}`);
                     incrementCount(modelName);
                 }, 50); // 50ms delay, adjust if needed
            }
        }, true); // Use capture phase to potentially catch event earlier

         console.log("Gemini Tracker: Send button listener attached to body.");
    }

    // --- Initialization ---
    // Wait for the main chat app elements to likely be present
    VM.observe(document.body, () => {
        // Check if the main chat interface seems ready
        const chatContainer = document.querySelector('chat-window');
        const inputArea = document.querySelector('input-area-v2'); // Use a specific element from the input area

        if (chatContainer && inputArea && !document.getElementById('gemini-tracker-toggle')) {
            console.log("Gemini Tracker: Initializing UI and listeners.");
            createUI();
            attachSendListener(); // Attach listener after UI is ready
            GM_registerMenuCommand("Reset Gemini Usage Counts", resetCounts); // Add menu command
            GM_registerMenuCommand("Toggle Gemini Usage UI", toggleUIVisibility);
            return true; // Stop observing once initialized
        }
        return false; // Continue observing
    });

})();
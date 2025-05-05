# 📊 Gemini Model Usage Tracker (Daily/Calendar)

A userscript designed for Tampermonkey/Violentmonkey that monitors and records the usage frequency of different Google Gemini AI models on a daily basis (using the UTC timezone). It features a modern UI panel 🖥️ with a calendar 📅 for navigating historical data and allows for manual count adjustments via a Developer Mode setting 🔒.

---

## ✨ Features

* ✅ **Daily Usage Tracking:** Automatically increments counters for identified Gemini models upon prompt submission (`Send` button click).
* ✅ **Model Identification:** Detects the active Gemini model (e.g., '2.5 Pro', '2.0 Flash') based on specific UI elements. Also attempts to identify and track potentially new/unnamed models 🤖.
* ✅ **Specific Model Tracking:** Includes dedicated logic to track usage of the 'Deep Research' feature via its confirmation button 🔬.
* ✅ **UTC Timezone:** All daily counts are logged against the corresponding UTC date (`YYYY-MM-DD`) ⏰.
* ✅ **UI Panel:** Provides a floating panel on the Gemini interface to display usage statistics.
    * **Toggle Button:** A dedicated button 🔘 to show or hide the statistics panel.
    * **Modern Interface:** Styled to be visually consistent with modern web applications ✨.
* ✅ **Calendar Date Selection 📅:** Integrates the `flatpickr` library to allow users to select specific past dates and view the corresponding usage counts.
* ✅ **Persistent Storage 💾:** Utilizes Greasemonkey API functions (`GM_getValue`, `GM_setValue`) to store usage data persistently in the browser's local storage.
* ✅ **Developer Mode 🔒:**
    * An optional mode (disabled by default) that enables manual editing of usage counts for the selected date ✏️.
    * Includes a button to reset all counts specifically for the currently selected date in the calendar 🔄.
* ✅ **Dynamic List:** The UI list adapts to show both predefined models and any newly detected models for the selected day.

---

## 🚀 Installation

1.  **1️⃣ Install a Userscript Manager:** You need a browser extension that can manage userscripts. Recommended options include:
    * [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari, Opera)
    * [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge, Opera)
    > **Note:** Greasemonkey for Firefox might work but compatibility with `@require` and `GM_addStyle` can vary.

2.  **2️⃣ Install the Script:** Click the installation link below or import the file URL into your userscript manager:
    * [**📥 Install Gemini Usage Tracker**](https://raw.githubusercontent.com/InvictusNavarchus/gemini-usage-tracker/master/gemini-usage-tracker.user.js)
    * Your userscript manager should prompt you to confirm the installation.

---

## 🖱️ Usage

1.  **Navigate to Gemini:** Open [https://gemini.google.com/](https://gemini.google.com/). The script automatically activates on matching pages.
2.  **Toggle Button:** A floating toggle button (cloud upload icon ☁️) will appear in the bottom-right corner of the page. Click this button to show or hide the usage tracker panel.
3.  **Usage Panel 🖥️:**
    * When opened, the panel displays the tracked usage counts for the **currently selected date** (defaults to the current UTC date).
    * The header shows the title, a date picker input, and a close button (`X`).
    * The list displays each tracked model and its corresponding usage count for that day.
    * Models with zero usage might still be listed if they are predefined or were used on other days. A message appears if no usage was tracked for the selected day.
4.  **Date Selection 📅:**
    * Click the date input field in the panel header.
    * A calendar will appear.
    * Select a date to view the usage statistics recorded for that specific UTC day. The calendar prevents selecting future dates.
5.  **Automatic Tracking ⚙️:** Usage counts are automatically incremented when you submit a prompt using the standard 'Send' button or confirm a 'Deep Research' request. The script attempts to identify the model active at the time of submission.
6.  **Developer Mode (Optional):** See the collapsible section below for details on editing counts.

---

<details>
<summary>🛠️ Editing Counts (Developer Mode - Click to Expand)</summary>

> **⚠️ Warning:** Editing counts is **disabled** by default to prevent accidental changes. Only enable this if you need to manually correct data.

1.  **Enable Developer Mode:**
    * Open the usage tracker panel.
    * Locate the "Developer Mode" setting (usually positioned above the 'Reset Counts' button).
    * Click the toggle switch to enable Developer Mode. The panel might visually change slightly (e.g., counts become interactive).
2.  **Edit a Count ✏️:**
    * With Developer Mode enabled, the numeric count next to each model name becomes clickable.
    * Click on the number you wish to edit. It will be replaced by an input field.
    * Enter the desired non-negative integer count.
    * Press `Enter` or click outside the input field (blur) to save the new value for the **currently selected date**.
    * Press `Escape` to cancel editing without saving.
3.  **Reset Counts for Day 🔄:**
    * With Developer Mode enabled or disabled, the "Reset Counts for Day" button is available at the bottom of the panel.
    * Clicking this button will prompt for confirmation.
    * If confirmed, it resets all model counts to zero specifically for the **currently selected date** in the calendar.
4.  **Disable Developer Mode:** Click the toggle switch again to disable editing capabilities.

</details>

---

## 💾 Data Storage

* The script uses the userscript manager's `GM_getValue` and `GM_setValue` functions, which typically store data within the browser's profile (similar to `localStorage` but sandboxed for the script).
* Usage data is stored under the key `geminiModelUsageCountsDaily` 🔑.
* Data is structured as a JSON object where keys are UTC dates in `YYYY-MM-DD` format, and values are objects containing model names and their respective counts for that day.
    > **Note:** ⏰ Dates and times are handled based on the **UTC timezone** to ensure consistency regardless of your local time.
* UI visibility state and Developer Mode status are stored under separate keys (`geminiModelUsageUIVisible`, `geminiTrackerDevModeEnabled`).

---

## 🧩 Dependencies

* **Userscript Manager:** Tampermonkey or Violentmonkey is required.
* **External Libraries (loaded via CDN) 🔗:**
    * `@violentmonkey/dom`: Used for DOM observation (`VM.observe`).
    * `flatpickr`: JavaScript library for the calendar date picker.
    * `flatpickr.min.css` & `dark.css`: CSS files for styling the `flatpickr` calendar.

---

## ⚠️ Known Issues / Limitations

> **Warning:** This script relies heavily on the specific HTML structure and CSS selectors of the Gemini website. **Significant changes by Google to the Gemini interface could break model detection or UI element targeting.** 🔗‍💥

* **Model Name Changes:** If Google renames models displayed in the UI, the script might track them as new entities until the `modelNames` constant in the script is updated.
* **Race Conditions (Unlikely):** Extremely rapid interactions might potentially lead to missed increments, although `setTimeout` is used to mitigate this during send detection.

---

## 📄 License

This project is licensed under the GPL v3 License - see the `LICENSE` file for details.*

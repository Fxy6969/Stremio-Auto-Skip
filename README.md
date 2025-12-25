⏩ Stremio Auto-Skip
A community-driven, intelligent auto-skipper for Stremio Enhanced. This plugin automatically detects and skips intros, outros, and recaps using a combination of subtitle analysis, audio fingerprinting, and a collaborative voting system.

Designed to complement the Stremio Glass Theme.

---

⚠️ Project Status: Pre-Release
Important Notice: The client-side plugin is currently hardcoded to communicate with localhost:3000. The backend server is not yet live. Currently, there is no way to use the plugin in a production environment until the official server release.

https://github.com/user-attachments/assets/1d5f08a9-8dd3-4589-b8b4-5715383cac14

✨ Key Features

Triple-Threat Detection:

Subtitle Parsing: Analyzes VTT/SRT data for structural cues and "Intro/Outro" keywords.

Chromaprint (fpcalc): Audio fingerprinting identifies recurring themes across episodes.

Crowdsourced Data: Leverages segments submitted by other users.

Voting System: Every skip segment is community-verified. Users can upvote accurate skips or submit corrections.

Automatic Execution: Once a segment reaches a verification threshold, the plugin skips it automatically—no buttons required.

Glass UI: A sleek, modern "Skip" button and notification system that matches the Glass Theme aesthetic.

---

🛠️ How it Works
The system utilizes a Client-Server Architecture:

The Backend (Server): A high-performance server that handles:

Audio Analysis: Processing audio chunks to find matches via Chromaprint.

Voting Logic: Managing a "trust" system to ensure skip timings are frame-accurate.

Database: Powered by Supabase for real-time segment delivery.

---

## 📥 Installation  

You have **two ways** to install Modern Glass:  

1. **Via Stremio Enhanced Marketplace (Recommended):**  
   - Open the **Stremio Enhanced Marketplace** inside Stremio -> Settings -> Scroll all the way down
   - Search for **Modern Glass** and its Plugins Tagged with **Modern Glass**  
   - Install it 

2. **Direct Download / Manual Installation:**  
   - Download the latest release from the [Releases Page](#)  
   - Install Stremio Enhanced (required)  
   - Drag and drop the downloaded files into your Stremio plugin/theme folder  
   - Restart Stremio to apply changes  

**REQUIRED CLIENT**: https://github.com/REVENGE977/stremio-enhanced

---

🗳️ Community & Voting
Accuracy is our priority. The voting system uses the following logic:

Verification: Segments are marked as "Verified" after reaching a community vote threshold (default: 3).

---

🔗 Related Projects
Stremio Glass Theme and its Plugin - The recommended UI for this plugin.

Created by Fxy6969


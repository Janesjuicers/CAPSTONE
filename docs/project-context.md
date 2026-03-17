# Project Context

## Overview
This project is the second phase of a final-year university capstone project, referred to as **Capstone B**, following completion of **Capstone A**. Capstone A established the research background, concept development, and preliminary planning. Capstone B is focused on turning that prior work into a functional real-world system.

The project is based on a **2 m bridge located at the university**. The bridge will be instrumented with sensors, most likely including one or more **accelerometers**, to measure structural response in real time. The sensor signals will be passed through a **GSV-8DS signal amplifier** and then into a **computer running MATLAB**.

The MATLAB system must do more than simply collect data. It must acquire live sensor data, process and interpret that data, and present it through a MATLAB-based interface. The interface should also include a visual bridge model that updates in real time and uses colour coding to indicate the current structural response or condition of the bridge.

In summary, the goal of Capstone B is to build a **real-time structural monitoring and visualization system in MATLAB**, using live data from the physical bridge, with the signal path running from **sensor → GSV-8DS amplifier → computer → MATLAB interface/model**.

## Objective
Develop a working MATLAB-based system that connects live sensor data from the physical bridge to a real-time digital visualization and monitoring interface.

## System Concept
The intended system should:
- collect structural response data from sensors attached to the 2 m bridge,
- pass that signal through the GSV-8DS signal amplifier,
- feed the data into MATLAB on a connected computer,
- process the incoming data in real time,
- display the results in a MATLAB interface/dashboard,
- visualize the bridge response using a bridge model,
- and use colour coding so that structural behaviour can be interpreted visually as data is received.

## Capstone A vs Capstone B
### Capstone A
Capstone A provided the project foundation, including:
- literature review and research background,
- concept development,
- planning,
- early justification of the project,
- and any preliminary modelling, analysis, or design decisions.

### Capstone B
Capstone B is focused on:
- implementation,
- integration of hardware and software,
- real-time data acquisition,
- real-time processing,
- MATLAB interface development,
- bridge model visualization,
- and testing/validation of the working system.

## Existing Reference Material
The Capstone A PDF files in this repository are provided as background reference material. Use them to understand the project history, prior research, earlier planning, and previous design thinking. Treat them as supporting context only, not as final implementation requirements for Capstone B.

## Hardware Context
Current known hardware components:
- **Physical structure:** 2 m bridge at the university
- **Sensors:** likely accelerometer(s), exact sensor configuration may still need confirmation
- **Signal conditioning / amplification:** GSV-8DS signal amplifier
- **Host system:** computer running MATLAB

## Software Requirements
The MATLAB side of the project is expected to include:
- live data acquisition from the connected hardware,
- signal handling and processing,
- a user interface or dashboard,
- a visual bridge representation or model,
- real-time updating of the visualization,
- and colour-coded indication of structural response or condition.

## Expected End Result
A functional prototype that links the physical bridge to a MATLAB-based monitoring and visualization system, producing a real-time digital representation of the bridge response using live sensor data.

## Important Constraints
- Do not assume hardware details that are not confirmed.
- Do not invent sensor specifications, communication protocols, or amplifier configuration settings unless they are documented elsewhere in the repository.
- If key implementation details are missing, identify them explicitly as assumptions or open questions.
- Prioritize clear, modular implementation so the system can be developed, tested, and debugged in parts.

## Current Unknowns / Open Questions
The following details may still need confirmation:
- exact sensor model(s) and number of sensors,
- how the GSV-8DS outputs data to the computer,
- the MATLAB interface method for acquiring that data,
- the response variable(s) to be visualized,
- the meaning of the colour coding,
- whether the bridge visualization should be 2D or 3D,
- required sampling rate,
- calibration requirements,
- filtering or signal conditioning requirements,
- and how the measured data should map onto the bridge model.

## Instructions for Codex
- Use the Capstone A PDF files in this repository as background context.
- Refer to them to understand the prior research, planning, and project development.
- Focus on the implementation goals of Capstone B rather than copying earlier assumptions directly.
- Treat the PDFs as reference material, not as the final source of truth for implementation.
- Flag any assumptions clearly.
- Prefer modular code structure, separating acquisition, processing, visualization, and interface logic where possible.
- Where requirements are unclear, identify the uncertainty instead of inventing details.

# Steam properties

`if97.mjs`: NeutriumJS.thermo.IAPWS97 1.2.2, Native Dynamics (2015).
Source: https://github.com/NativeDynamics/NeutriumJS.thermo.IAPWS97
Package: https://registry.npmjs.org/neutriumjs.thermo.iapws97/-/neutriumjs.thermo.iapws97-1.2.2.tgz
License: Creative Commons Attribution 4.0 International, full text in LICENSE.txt.
Adaptation: concatenate core + PT sources, replace UMD `this` with `globalThis`,
and add an ES module export. No property coefficients changed.

The application uses only region 1/2 forward equations and region 4 saturation.
The turbine wrapper restricts pressure to 0.001–10 MPa and temperature to 800 °C,
requires superheated inlet steam, and computes the outlet by phase-aware inversion.
Regions 3/5 and transport properties from this library are not used or validated.
Official verification source: https://iapws.org/technical-guidance/release/IF97-Rev

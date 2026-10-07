# Terms of Use

**Kepler Exoplanet Detection (AstroNet-style 1D CNN)**
Version 1.0. Effective October 6, 2026.

By running the notebooks, the `app.py` web demo, or any code in this repository, or by using a hosted copy of the demo, you agree to these Terms. If you do not agree, do not use the project.

The software asks you to accept these Terms before it downloads data, trains, or makes predictions. Your acceptance is saved locally in `.terms_accepted`. If the version number above changes, you will be asked to accept again.

---

## 1. Purpose and permitted use

This project was built as a student portfolio project for *Computer Vision, ITAI 1378* at San Antonio College. You may view, run, and modify the code for:

- personal learning and teaching,
- academic coursework, with proper citation (see §8), and
- non-commercial research and experimentation.

Commercial use, redistribution as part of a paid product or service, or presenting the work as your own requires prior written permission from the author.

## 2. Not a scientific instrument

The model is an educational prototype. Its reported test accuracy is about 70% and its test AUC is about 0.77 (V1.5), which is below the project's own targets.

- Its predictions are **not** official classifications. They do not replace NASA Exoplanet Archive dispositions or peer-reviewed vetting.
- Do not present a prediction as a discovery, confirmation, or rejection of an exoplanet in any publication, report, or public statement.
- A "PLANET" or "FALSE POSITIVE" output only means the CNN's score was above or below 0.5 for one phase-folded light curve.

## 3. Third-party data and services

The project downloads data at run time from:

- **NASA Exoplanet Archive** (operated by Caltech/IPAC under contract with NASA), and
- **MAST**, the Mikulski Archive for Space Telescopes (operated by STScI), accessed through the `lightkurve` library.

You agree to:

- follow the usage policies of those services and credit them in any work that uses this data (see their acknowledgement guidelines),
- use them responsibly, without excessive parallel requests, repeated full re-downloads, or automated scraping beyond what the pipeline needs, and
- accept that availability, rate limits, and content are controlled by those providers, not by this project.

NASA and STScI do not endorse this project. Their names are used only to identify data sources.

## 4. Third-party software

The project depends on open-source packages, including TensorFlow/Keras, lightkurve, astropy, scikit-learn, pandas, NumPy, matplotlib, seaborn, and Gradio. Each package is governed by its own license, and you are responsible for complying with those licenses.

## 5. No warranty

THE SOFTWARE, MODEL, AND OUTPUTS ARE PROVIDED **"AS IS"**, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THIS INCLUDES ANY WARRANTY OF ACCURACY, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. You use the project at your own risk.

## 6. The web demo and public links

- By default, `app.py` runs only on your own computer (`127.0.0.1`).
- If you start it with `--share`, Gradio creates a temporary public URL routed through Gradio's servers. Anyone with the link can use the demo, and each use causes your machine to make requests to NASA/MAST. You are responsible for who you share the link with and for any traffic it generates.
- The demo does not store your inputs. However, Gradio's relay and the data providers may log requests under their own privacy policies.
- Anyone using the demo must also accept these Terms, using the checkbox in the app.

## 7. Limitation of liability

To the fullest extent permitted by law, the author is not liable for any direct, indirect, incidental, or consequential damages arising from the use of, or inability to use, this project. This includes lost data, wrong conclusions drawn from model output, and costs or service restrictions caused by your network usage.

## 8. Attribution and academic integrity

If you use or adapt this project, cite it as:

> Medina, F. (2026). *Kepler Exoplanet Detection — AstroNet-style 1D CNN*. GitHub: med27-coder/cv-project-kepler-exoplanet-detection-inventory.

The architecture is inspired by Shallue & Vanderburg (2018), *Identifying Exoplanets with Deep Learning* (AJ 155, 94). Credit that work as well.

Students must follow their institution's academic-integrity policy. Submitting this work, or a lightly modified version of it, as your own coursework is not permitted.

## 9. Changes

These Terms may be updated. Material changes will increase the version number, and the software will ask you to accept again before you continue.

## 10. Contact

Questions about these Terms: Francisco Medina, franciscomed927@gmail.com, GitHub [med27-coder](https://github.com/med27-coder).

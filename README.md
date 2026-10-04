# Indra Kumar — research and engineering portfolio

Static portfolio for https://sincerelyindra.github.io/, with a research introduction, professional experience, eight project studies, and a printable web résumé. The site uses HTML, CSS, and a small JavaScript file; no build step or third-party frontend dependency is required.

## Content

- `index.html`: introduction, research interests, selected studies, and concise experience at OLA, the Transportation Networks Laboratory at IISc, and Photomath.
- `resume.html`: full professional experience, academic background, project summaries, and skills. Use **Print / Save as PDF** for the print layout.
- `projects.html` and `projects/`: the eight research and implementation project studies, with team attribution, experimental results, limitations, and supporting repository links.
- `assets/style.css`: shared typography, responsive layouts, and print styles.
- `assets/site.js`: mobile navigation and the résumé print action.

## Preview and deployment

Open `index.html` locally, or serve the repository with a local static server. GitHub Pages publishes the `main` branch from the repository root. `.nojekyll` keeps the files as a plain static site.

## Updating the portfolio

Keep dates and role descriptions consistent between the homepage and résumé. Shared navigation appears on every HTML page; update relative links in project detail pages when changing navigation. The current `assets/profile.png` is the GitHub avatar and can be replaced with a preferred portrait.

The About page’s Research projects section includes the rotating research map in `assets/research-map.js` and `assets/research-map.css`. It supports dragging, theme selection, and pause/resume; rotation pauses offscreen and starts paused for reduced-motion preferences. These assets load only on the About page. The underlying project studies, experience, and navigation remain available without JavaScript.

## Source and attribution

Professional experience is based on the supplied September 2026 résumé image. The homepage summarizes that source; the web résumé retains fuller methods and evaluation detail. It distinguishes the current OLA role from the completed IISc research period.

Project studies retain the existing report-based results and team attribution. Repository links identify supporting material; earlier report-linked repositories remain available where supplied. Numerical results describe their reported experimental settings, and the medical-imaging study explicitly credits Indra Kumar with the 3D approach.

No publications, awards, completed degrees, education dates, CGPA, hiring availability, or unsupported outcome metrics have been added. The M.Tech thesis wording reflects the supplied experience entry. Original project submissions, student identification numbers, and collaborators’ contact details are not published.


## GPT-2 implementation study

`projects/gpt2-from-scratch.html` presents **GPT-2 From Scratch – LLM Systems** (June 2025), based on the supplied project-summary image and the explicitly credited Karpathy reproduction. Its dedicated `assets/gpt2-study.css` and `assets/gpt2-study.js` load only on this page. The homepage, research index, and the About page’s Machine Learning and RAG / LLMs research-map entries link to the study.

The page includes a pre-LayerNorm decoder schematic, an accessible six-position causal-mask explorer, a parameter-budget calculation with tied embeddings counted once, and a symbolic next-token decoding example. Figures distinguish canonical architecture and teaching examples from recorded project evidence. The 124,439,808 count is derived from GPT-2 small dimensions; the page does not claim a measured training parameter count.

The June 2025 summary documents a PyTorch decoder reimplementation, official-checkpoint loading and numerical agreement with Hugging Face logits, generation, and domain fine-tuning with cross-entropy, AdamW, scheduling, and mixed precision. It supplies no code repository, dataset, training logs, numerical tolerance, benchmark scores, or full pretraining-run evidence. The page does not invent these details or attribute Karpathy’s upstream results to this project. “From Scratch” describes the decoder implementation.

Technical references are linked next to relevant explanations and collected at the end. Controls support keyboard interaction; diagrams and content remain informative without JavaScript. There are no remote scripts, model downloads, or API calls, and the decoding demo does not execute a language model.

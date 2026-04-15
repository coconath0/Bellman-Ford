# Bellman-Ford

Bellman-Ford is an educational web project that explains how the Bellman-Ford shortest-path algorithm works and provides an interactive demo to explore it visually.

The site includes:
- A landing page with sections about the algorithm, Richard Bellman, Lester Ford, and project context.
- A dedicated interactive implementation page where users can build a graph, run Bellman-Ford, and inspect shortest paths and passes.
- A responsive navigation/menu system and animated visual effects.

## Technologies Used

- HTML: structure of all pages.
- CSS: custom styling, responsive breakpoints, and component layouts.
- Vanilla JavaScript: interactions, navigation behavior, and Bellman-Ford execution logic.
- Canvas API: graph rendering and path/pass visualization in the interactive implementation.
- Firebase: analytics initialization in the main page.

## Particles Background Library

This project uses the particles.js library to render the animated background in the hero section.

Files used:
- `particles/particles.min.js`: local minified particles.js library.
- `particles/particlesjs-config.json`: JavaScript configuration object that initializes particles via `particlesJS({...})`.

Current behavior configured in this project:
- Circular particles with connecting lines.
- Hover interaction in `grab` mode.
- Click interaction in `push` mode (adds particles).
- Retina detection enabled for sharper rendering on high-density displays.

In `index.html`, both files are loaded in sequence so the effect starts automatically when the page loads.

## Project Structure

- `index.html`: main landing page.
- `implementation.html`: interactive Bellman-Ford demo page.
- `css/`: global and page-specific styles.
- `js/`: behavior for navigation and interactions.
- `particles/`: particles.js runtime and configuration.
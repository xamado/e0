---
title: "Event Zero"
tagline: "AAA engineering · co-development"
press: "Press any button"

# Caption in the main menu's bottom-right corner, describing the background.
# Keys: scene types, or particles-<style> (attractors: particles-attractor-<0..3>).
# {count} is replaced with the current particle count.
captions:
  particles-attractor-0: { title: "Lorenz attractor", text: "{count} particles following Edward Lorenz's 1963 model of convection in the atmosphere. Fully deterministic, yet it never repeats: the shape that gave chaos theory its butterfly." }
  particles-attractor-1: { title: "Aizawa attractor", text: "{count} particles tracing a strange attractor: simple equations, a path that never closes and never escapes the shape." }
  particles-attractor-2: { title: "Thomas attractor", text: "{count} particles in René Thomas' cyclically symmetric system, wandering forever through a lattice of loops." }
  particles-attractor-3: { title: "Halvorsen attractor", text: "{count} particles on a three-fold symmetric strange attractor. Chaotic, bounded, and never the same twice." }
  particles-flow: { title: "Curl-noise flow", text: "{count} particles carried by a divergence-free noise field, so they swirl like smoke instead of bunching up." }
  particles-galaxy: { title: "Spiral galaxy", text: "{count} stars on rotated elliptical orbits; the arms are density waves that hold their shape as the disk turns." }
  particles-shapes: { title: "Point-cloud morph", text: "{count} particles on springs, flowing between a sphere, torus, cube, double helix and trefoil knot." }
  particles-gravity: { title: "Gravitational waves", text: "Two black holes spiralling together on a sheet of spacetime, following the inspiral chirp: faster and faster until they merge and ring down." }
  particles-swarm: { title: "Swarm", text: "{count} particles chasing moving leaders, each in its own orbit, like a flock that never settles." }
  mountains: { title: "Mountain dusk", text: "Layered ridges, drifting fog and a setting sun, rendered live in a single fragment shader." }
  terrain: { title: "Terrain flyover", text: "A ray-marched heightfield with soft shadows and water reflections, flown at a constant altitude along a river canyon." }
  planet: { title: "Planet from orbit", text: "Procedural continents, clouds and city lights under a scattering atmosphere, all computed per pixel in real time." }
  ocean: { title: "Open ocean", text: "Ray-marched waves with Fresnel reflections and sun glitter, out to the horizon." }
cascade:
  - build:
      render: "never"
      list: "always"
      publishResources: false
    target:
      kind: "{section,page}"
---

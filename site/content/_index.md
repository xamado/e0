---
title: "Event Zero"
tagline: "AAA engineering · co-development"
press: "Press any button"

# Items (services, games) are selections inside their section's page, not pages of their own.
cascade:
  - build:
      render: never
      list: always
      publishResources: false   # only the processed posters are published
    target:
      kind: page

# Caption in the main menu's bottom-right corner, describing the background.
# {count} is replaced with the current particle count.
caption:
  title: "Lorenz attractor"
  text: "{count} particles following Edward Lorenz's 1963 model of convection in the atmosphere. Fully deterministic, yet it never repeats: the shape that gave chaos theory its butterfly."
---

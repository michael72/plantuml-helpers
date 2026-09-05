# PlantUML Helpers Architecture

This document describes the architecture of the PlantUML Helpers VS Code extension.

## Overview

The PlantUML Helpers extension provides functionality for editing and previewing PlantUML diagrams within VS Code. It supports multiple rendering backends including the public PlantUML server, a local pumlsrv instance, and custom servers.

## Component Diagram

```plantuml
@startuml
title PlantUML Helpers Extension Components

skinparam component {
  BackgroundColor<<main>> LightBlue
  BorderColor<<main>> Blue
  ArrowColor<<main>> Blue
}

skinparam rectangle {
  BackgroundColor<<main>> LightBlue
  BorderColor<<main>> Blue
}

package "VS Code Extension" {
  [Extension Host] <<main>>
  [PlantUML Preview Panel] <<main>>
  [Markdown It Plugin] <<main>>
  [Theme Service] <<main>>
  [Completion Provider] <<main>>
  [PlantUML Service] <<main>>
  [PlantUML Encoder] <<main>>
  [SVG Sanitizer] <<main>>
  [pumlsrv Service] <<main>>
  [pumlsrv Installer] <<main>>
}

[Extension Host] --> [PlantUML Preview Panel] : Show preview
[Extension Host] --> [Markdown It Plugin] : Render diagrams in markdown
[Extension Host] --> [Theme Service] : Set theme
[Extension Host] --> [Completion Provider] : Autocomplete keywords
[Extension Host] --> [PlantUML Service] : Fetch diagrams from server
[Extension Host] --> [pumlsrv Service] : Manage pumlsrv process

[PlantUML Preview Panel] --> [PlantUML Service] : Request SVG
[PlantUML Service] --> [pumlsrv Service] : Local pumlsrv requests
[PlantUML Service] --> [PlantUML Server] : External server requests

[PlantUML Service] --> [PlantUML Encoder] : Encode diagram text
[PlantUML Service] --> [SVG Sanitizer] : Sanitize SVG output
[PlantUML Service] --> [Markdown It Plugin] : Cache-hit SVGs

[pumlsrv Service] --> [pumlsrv Installer] : Install if missing

note right of [PlantUML Service]
  Handles communication with PlantUML servers
  Supports GET and POST methods
  Manages server type configuration
  Encodes and sanitizes internally
end note

note right of [pumlsrv Service]
  Manages local pumlsrv process
  Starts/stops pumlsrv when needed
  Handles port allocation
end note

note right of [pumlsrv Installer]
  Downloads and installs pumlsrv jar
  Verifies sha256 checksum
  Creates launcher script
end note

note right of [Theme Service]
  Fetches available themes from server
  Persists theme selection to settings
  Injects !theme directive into diagrams
end note

note right of [Completion Provider]
  Provides keyword and snippet completions
  Works in .puml files and markdown fences
end note

@enduml
```

## Architecture Flow

```plantuml
@startuml
title PlantUML Helpers Architecture Flow

start

:User opens PlantUML file;
:Extension activates;
:User triggers preview command;
if (Server type is Local pumlsrv?) then (yes)
  :Check if pumlsrv is running;
  if (Not running?) then (yes)
    :Install pumlsrv if needed;
    :Start pumlsrv process;
  else (no)
    :Reuse existing pumlsrv;
  endif
  :Send diagram to pumlsrv via POST;
else (no)
  :Send diagram to PlantUML server via GET/POST;
endif

:Fetch SVG from server;
:Sanitize SVG output;
:Display in preview panel;

stop
@enduml
```

## Data Flow Diagram

```plantuml
@startuml
title PlantUML Helpers Data Flow

actor User

User --> (Edit PlantUML)
(Edit PlantUML) --> [Extension Host]
[Extension Host] --> [PlantUML Service]
[PlantUML Service] --> [PlantUML Encoder]
[PlantUML Service] --> [PlantUML Server]
[PlantUML Server] --> [PlantUML Service]
[PlantUML Service] --> [SVG Sanitizer]
[SVG Sanitizer] --> [PlantUML Service]
[PlantUML Service] --> [Extension Host]
[Extension Host] --> [PlantUML Preview Panel]
[PlantUML Preview Panel] --> User

note right of [PlantUML Service]
  Handles HTTP communication
  Supports different server types
  Encodes and sanitizes internally
  Caches rendered SVGs for markdown
end note

note right of [SVG Sanitizer]
  Sanitizes SVG output for security
  Removes potentially dangerous elements
end note

note right of [PlantUML Preview Panel]
  Displays rendered diagrams
  Provides zoom controls
  Includes toolbar for auto-format and reset
end note
@enduml
```

## Key Modules

```plantuml
@startuml
title PlantUML Helpers Key Modules

class "Extension Host\n(module)" as ext {
  +activate()
  +deactivate()
}

class "PlantUmlPreviewPanel\n(class)" as panel {
  +createOrShow(extensionUri)
  +updateSvg(svgContent)
  +showError(message)
  +showLoading()
  +setMessageHandler(handler)
}

class "PlantUML Service\n(module)" as svc {
  +fetchSvg(diagramText)
  +getRenderMethod()
  +getServerUrl()
}

class "PlantUML Encoder\n(module)" as enc {
  +encodePlantUml(text)
}

class "SVG Sanitizer\n(module)" as san {
  +sanitizeSvg(svg)
}

class "pumlsrv Service\n(module)" as psvc {
  +ensurePumlsrvRunning()
  +stopPumlsrv()
  +installPumlsrvManually()
  +getServerType()
  +getServerUrl()
}

class "Markdown It Plugin\n(module)" as md {
  +plantUmlPlugin(md, onAllFetched)
}

class "pumlsrv Installer\n(module)" as inst {
  +installPinnedPumlsrv()
  +getPumlsrvBinDir()
  +sha256OfFile(filePath)
}

class "Theme Service\n(module)" as theme {
  +registerSetThemeCommand()
  +addTheme(diagramText)
  +getThemeSetting()
  +getAvailableThemes()
}

class "Completion Provider\n(module)" as comp {
  +registerPlantUmlCompletionProvider()
}

ext --> panel
ext --> svc
ext --> psvc
ext --> md
ext --> theme
ext --> comp

svc --> enc
svc --> san
svc --> psvc

panel --> svc

psvc --> inst

@enduml
```

## Configuration Flow

```plantuml
@startuml
title PlantUML Helpers Configuration Flow

start

:User opens VS Code settings;
:User selects server type;
if (Server type is Local pumlsrv?) then (yes)
  :Start pumlsrv process;
  :Check if already installed;
  if (Not installed?) then (yes)
    :Install pumlsrv binary;
  else (no)
    :Use existing installation;
  endif
else (no)
  :Use configured PlantUML server;
endif

:User selects render method;
:User selects theme;
:Configuration saved;

stop
@enduml
```

## Extension Commands

```plantuml
@startuml
title PlantUML Helpers Extension Commands

rectangle "Swap Arrow" as swap
rectangle "Rotate Left" as rotL
rectangle "Rotate Right" as rotR
rectangle "Auto Format" as fmt
rectangle "Reset Arrows" as reset
rectangle "Show Preview" as prev
rectangle "Set Theme" as theme
rectangle "Install pumlsrv" as install

note right of swap
  Command: pumlhelper.swapLine
  Description: Swap arrow and content
end note

note right of rotL
  Command: pumlhelper.rotateLineLeft
  Description: Rotate arrow left
end note

note right of rotR
  Command: pumlhelper.rotateLineRight
  Description: Rotate arrow right
end note

note right of fmt
  Command: pumlhelper.autoFormat
  Description: Auto Format (fix arrow layout)
end note

note right of reset
  Command: pumlhelper.reFormat
  Description: Reset Arrow Directions to Defaults
end note

note right of prev
  Command: pumlhelper.showPreview
  Description: Show PlantUML Preview
end note

note right of theme
  Command: pumlhelper.setTheme
  Description: Set theme
end note

note right of install
  Command: pumlhelper.installPumlsrv
  Description: Install pumlsrv
end note
@enduml
```
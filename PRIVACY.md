# Privacy

enCounter is designed as a local-first application.

## Data stored by the application

enCounter may store encounter information, Library entries, settings, recovery snapshots, asset references, and exported backup data on the user's computer.

Browser application data is stored in IndexedDB. Disk backups, exports, imports, and user-supplied assets may also be stored in the enCounter folder.

## Network behavior

The current Alpha launcher binds its local web server to `127.0.0.1`. enCounter does not intentionally transmit encounter or Library content to an enCounter-operated cloud service.

The local HTTP server restricts browser-accessible files to enCounter application resources, public legal/documentation files, and supported asset types. Runtime backup files under `data/` and development/build source files are not intentionally exposed through the local HTTP server.

Browser, operating-system, security software, and third-party services used by the user are outside enCounter's control and may have their own privacy behavior.

## AI development disclosure

Generative AI tools have been used to assist with development of enCounter. This development-time use is separate from runtime behavior. The current application does not include generative-AI functionality and does not intentionally send encounter, Library, or campaign data to an AI service.

See `AI_ASSISTANCE.md` for details.

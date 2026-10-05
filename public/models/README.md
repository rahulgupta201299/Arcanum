# Librarian avatars (optional)

Drop rigged GLB files here to replace the procedural librarian:

- `librarian-female.glb`
- `librarian-male.glb`

Any humanoid rig works (Ready Player Me, Mixamo, Character Creator, MetaHuman → glTF export).
Include animation clips whose names contain: `idle`, `walk`, `talk`, `think`, `reach` (or `pick`),
`present` (or `hold`), `wave`. Bones named `*RightHand`, `*LeftHand`, `*Head` are used to attach the book.
Compress with `npx gltf-transform optimize in.glb out.glb --texture-compress webp` (Draco/Meshopt).

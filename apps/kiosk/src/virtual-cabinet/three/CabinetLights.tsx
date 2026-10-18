import React from 'react';

export function CabinetLights() {
  return (
    <>
      {/* Balanced ambient fill so chamber interiors retain 3D depth instead of clipping to white */}
      <ambientLight intensity={0.55} color="#f8fafc" />

      {/* Warm natural hemisphere light (sky-to-ground gradient) */}
      <hemisphereLight args={['#fffbeb', '#0f291e', 0.45]} />

      {/* Main Key Light: Front-top-right for crisp specular highlights on chrome & flowers */}
      <directionalLight position={[2.8, 3.8, 4.2]} intensity={1.15} color="#fffaf0" />

      {/* Soft Cool Front-Left Fill Light: reveals dark emerald cabinet bevels */}
      <directionalLight position={[-2.6, 1.8, 3.2]} intensity={0.65} color="#e0f2fe" />

      {/* Rim / Silhouette Backlight: separates cabinet edges from background */}
      <directionalLight position={[0, 3.2, -3.0]} intensity={0.55} color="#6ee7b7" />
    </>
  );
}

export default React.memo(CabinetLights);

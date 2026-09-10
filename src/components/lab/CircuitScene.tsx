import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, Text, ContactShadows } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Props = {
  closed: boolean;
  onToggle: () => void;
  voltage: number;
  resistance: number;
};

const NAVY = "#1b2a4a";
const SAFFRON = "#e8912d";

function Bench() {
  return (
    <group>
      <mesh position={[0, -0.35, 0]} receiveShadow>
        <boxGeometry args={[9, 0.5, 6]} />
        <meshStandardMaterial color="#6b4b32" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[7.2, 0.12, 4.4]} />
        <meshStandardMaterial color="#12202f" roughness={0.5} metalness={0.2} />
      </mesh>
    </group>
  );
}

/** A straight wire segment between two points. */
function Wire({
  from,
  to,
  live,
}: {
  from: [number, number, number];
  to: [number, number, number];
  live: boolean;
}) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return {
      pos: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      quat: q,
      len: dir.length(),
    };
  }, [from, to]);

  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[0.055, 0.055, len, 12]} />
      <meshStandardMaterial
        color={live ? "#c8452b" : "#2f3946"}
        emissive={live ? "#7a1f10" : "#000000"}
        emissiveIntensity={live ? 0.6 : 0}
        roughness={0.4}
        metalness={0.35}
      />
    </mesh>
  );
}

function Battery({ voltage }: { voltage: number }) {
  return (
    <group position={[-2.4, 0.35, 0.9]}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.7, 0.9]} />
        <meshStandardMaterial color={NAVY} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.55, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.25, 12]} />
        <meshStandardMaterial color="#d9534f" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[-0.55, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.25, 12]} />
        <meshStandardMaterial color="#4a5568" metalness={0.8} roughness={0.25} />
      </mesh>
      <Text position={[0, 0, 0.47]} fontSize={0.22} color="#f5e6c8" anchorY="middle">
        {`${voltage.toFixed(0)} V`}
      </Text>
    </group>
  );
}

function Switch({ closed, onToggle }: { closed: boolean; onToggle: () => void }) {
  const lever = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);

  useFrame((_, delta) => {
    if (!lever.current) return;
    const target = closed ? 0 : -0.7;
    lever.current.rotation.z +=
      (target - lever.current.rotation.z) * (1 - Math.exp(-14 * Math.min(delta, 0.05)));
  });

  return (
    <group
      position={[0, 0.05, 1.9]}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.2, 0.7]} />
        <meshStandardMaterial
          color={hover ? "#2b3c60" : "#22304d"}
          roughness={0.5}
          emissive={hover ? SAFFRON : "#000000"}
          emissiveIntensity={hover ? 0.18 : 0}
        />
      </mesh>
      <mesh position={[-0.5, 0.12, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 12]} />
        <meshStandardMaterial color="#c0c6cc" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.5, 0.12, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 12]} />
        <meshStandardMaterial color="#c0c6cc" metalness={0.9} roughness={0.2} />
      </mesh>
      <group ref={lever} position={[-0.5, 0.18, 0]} rotation-z={-0.7}>
        <mesh position={[0.5, 0.03, 0]} castShadow>
          <boxGeometry args={[1.0, 0.07, 0.14]} />
          <meshStandardMaterial color={SAFFRON} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function Resistor({ resistance }: { resistance: number }) {
  return (
    <group position={[2.4, 0.3, 0.9]} rotation-z={Math.PI / 2}>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.22, 1.0, 20]} />
        <meshStandardMaterial color="#c8a97e" roughness={0.7} />
      </mesh>
      {[-0.28, 0, 0.28].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[0.23, 0.23, 0.1, 20]} />
          <meshStandardMaterial
            color={["#8b3a1f", "#1c1c1c", "#c9a227"][i]}
            roughness={0.6}
          />
        </mesh>
      ))}
      <Text
        position={[0, 0, 0.3]}
        rotation-z={-Math.PI / 2}
        fontSize={0.2}
        color="#f5e6c8"
      >
        {`${resistance.toFixed(0)} Ω`}
      </Text>
    </group>
  );
}

function Bulb({ brightness }: { brightness: number }) {
  const glass = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!glass.current) return;
    const flicker = 1 + Math.sin(state.clock.elapsedTime * 9) * 0.04 * (brightness > 0 ? 1 : 0);
    const mat = glass.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = brightness * 2.6 * flicker;
  });

  return (
    <group position={[0, 0.35, -1.7]}>
      <mesh position={[0, -0.25, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.3, 0.42, 20]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh ref={glass} position={[0, 0.32, 0]} castShadow>
        <sphereGeometry args={[0.45, 28, 28]} />
        <meshStandardMaterial
          color="#fff3cf"
          emissive="#ffca63"
          emissiveIntensity={0}
          transparent
          opacity={0.85}
          roughness={0.15}
        />
      </mesh>
      <pointLight
        position={[0, 0.4, 0]}
        intensity={brightness * 9}
        distance={9}
        color="#ffd489"
        castShadow
      />
    </group>
  );
}

function Electron({ progress, live }: { progress: number; live: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const path = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-2.4, 0.2, 1.9),
          new THREE.Vector3(0, 0.2, 1.9),
          new THREE.Vector3(2.4, 0.2, 1.9),
          new THREE.Vector3(2.4, 0.2, 0.9),
          new THREE.Vector3(2.4, 0.2, -1.7),
          new THREE.Vector3(0, 0.2, -1.7),
          new THREE.Vector3(-2.4, 0.2, -1.7),
          new THREE.Vector3(-2.4, 0.2, 0.9),
        ],
        true,
        "catmullrom",
        0.02,
      ),
    [],
  );
  const offset = useRef(progress);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (live) offset.current = (offset.current + Math.min(delta, 0.05) * 0.25) % 1;
    ref.current.visible = live;
    ref.current.position.copy(path.getPointAt(offset.current));
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.085, 12, 12]} />
      <meshStandardMaterial color="#7fd7ff" emissive="#3fa9d6" emissiveIntensity={2} />
    </mesh>
  );
}

function Circuit({ closed, onToggle, voltage, resistance }: Props) {
  const live = closed;
  const current = closed ? voltage / Math.max(resistance, 1) : 0;
  const brightness = Math.min(1, current / 1.2);

  return (
    <group>
      <Bench />
      {/* circuit loop wiring */}
      <Wire from={[-2.4, 0.2, 0.9]} to={[-2.4, 0.2, 1.9]} live={live} />
      <Wire from={[-2.4, 0.2, 1.9]} to={[-0.7, 0.2, 1.9]} live={live} />
      <Wire from={[0.7, 0.2, 1.9]} to={[2.4, 0.2, 1.9]} live={live} />
      <Wire from={[2.4, 0.2, 1.9]} to={[2.4, 0.2, 0.9]} live={live} />
      <Wire from={[2.4, 0.2, 0.9]} to={[2.4, 0.2, -1.7]} live={live} />
      <Wire from={[2.4, 0.2, -1.7]} to={[0, 0.2, -1.7]} live={live} />
      <Wire from={[0, 0.2, -1.7]} to={[-2.4, 0.2, -1.7]} live={live} />
      <Wire from={[-2.4, 0.2, -1.7]} to={[-2.4, 0.2, 0.9]} live={live} />

      <Battery voltage={voltage} />
      <Switch closed={closed} onToggle={onToggle} />
      <Resistor resistance={resistance} />
      <Bulb brightness={brightness} />

      {[0, 0.25, 0.5, 0.75].map((p) => (
        <Electron key={p} progress={p} live={live} />
      ))}

      <Text position={[0, 1.6, -1.7]} fontSize={0.28} color="#f5e6c8" anchorY="middle">
        {closed ? `I = ${current.toFixed(2)} A` : "Circuit open"}
      </Text>

      <ContactShadows position={[0, -0.01, 0]} opacity={0.45} scale={12} blur={2.4} far={4} />
    </group>
  );
}

export default function CircuitScene(props: Props) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 4.6, 7.2], fov: 50 }}>
      <color attach="background" args={["#0d1626"]} />
      <fog attach="fog" args={["#0d1626", 14, 30]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#a9c4e8", "#2a2118", 0.5]} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Environment>
        <Lightformer intensity={1.6} position={[0, 6, 2]} scale={[10, 10, 1]} />
        <Lightformer
          intensity={0.9}
          color="#ffd7a1"
          position={[-6, 2, -2]}
          rotation-y={Math.PI / 2}
          scale={[14, 2, 1]}
        />
      </Environment>
      <Circuit {...props} />
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0.3, 0]}
      />
    </Canvas>
  );
}

// src/components/AIProcessingToast.tsx
import React from "react";

type Props = {
  /** Message à afficher dans le toast (null => rien n'est rendu) */
  aiProcessingMsg: string | null;
  /** Optionnel : callback pour fermer manuellement le toast */
  onClose?: () => void;
};

const AIProcessingToast: React.FC<Props> = ({ aiProcessingMsg, onClose }) => {
  if (!aiProcessingMsg) return null;

  return (
    <div
      className="ai-processing-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        className="ai-dot"
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#e0e7ff",
          display: "inline-block",
          animation: "pulse 1.2s ease-in-out infinite",
        }}
      />
      <span>{aiProcessingMsg}</span>

      {onClose && (
        <button
          onClick={onClose}
          aria-label="Fermer la notification"
          style={{
            marginLeft: 8,
            border: 0,
            background: "transparent",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default AIProcessingToast;

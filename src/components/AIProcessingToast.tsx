import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBrain, faSpinner } from "@fortawesome/free-solid-svg-icons";

interface Props {
  aiProcessingMsg: string | null;
}

const AIProcessingToast: React.FC<Props> = ({ aiProcessingMsg }) => {
  if (!aiProcessingMsg) return null;

  return (
    <div className="ai-processing-toast">
      <FontAwesomeIcon icon={faBrain} className="brain-icon" />
      <FontAwesomeIcon icon={faSpinner} spin />
      <span>{aiProcessingMsg}</span>
    </div>
  );
};

export default AIProcessingToast;

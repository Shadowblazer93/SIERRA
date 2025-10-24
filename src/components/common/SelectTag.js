import React from 'react';
import {Tag, Typography} from 'antd'
import './SelectTag.css'
export default function ({onClick, text, colour}) {
  return (
    <Tag
      className='predicate-tag'
      onClick={onClick}
      key={`${text}-k`}
      color={colour}
    >
      {text}
    </Tag>
  )
}

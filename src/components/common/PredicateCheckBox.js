import React, {useState} from 'react';
import { Checkbox, Typography } from 'antd';
import './predicateCheckBox.css';

const {Text} = Typography
const PredicateCheckBox = ({checked, title, palette, onAddPredicate, onDeletePredicate}) => {
  return (
    <div
      style={{
        "--hover-background-color": palette.light,
        backgroundColor: checked ? palette.light: '',
      }}
      onClick={() => {
        if(checked) {
          onDeletePredicate()
        } else {
          onAddPredicate()
        }
      }}
      className="predicate-container">
      <Checkbox
        checked={checked}
        style={
          { height: 22,
            marginRight: 8,
            "--background-color": palette.primary,
            "--border-color": palette.secondary,

          }} />
      <Text style={{marginBottom: 0}}>{title}</Text>
    </div>
  )
}

export default PredicateCheckBox

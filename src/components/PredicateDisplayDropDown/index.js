import React from 'react'
import {Select} from 'antd'
import './index.css'

const {Option} = Select
const PredicateDisplayDropDown = ({value, onSelect}) => {
  return (
    <Select className='customDrop' value={{value:value}} labelInValue
      style={{
        width: 90,
        marginLeft:8,
      }}
      onChange={(v) => {
        onSelect(v.value)
      }}>
      <Option value="FULL">Full</Option>
      <Option value="SEMI">Semi</Option>
      <Option value="HIDDEN">Hidden</Option>
    </Select>
  )
}

export default PredicateDisplayDropDown

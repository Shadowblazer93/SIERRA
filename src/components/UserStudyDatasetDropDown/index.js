import React from 'react'
import {Select, Typography} from 'antd'
import './index.css'

const {Option} = Select
const {Text} = Typography
const UserStudyDatasetDropDown = ({value, onSelect}) => {
  return (
    <>
      <Text
        style={{
          marginLeft:8,
        }}
      >Data Set: </Text>
      <Select className='customDrop' value={{value:value}} labelInValue
        style={{
          width: 110,
          marginLeft:4,
        }}
        onChange={(v) => {
          onSelect(v.value)
        }}>
        <Option value="Northwind">Northwind</Option>
        <Option value="Movies">Movies</Option>
      </Select>
    </>
  )
}

export default UserStudyDatasetDropDown

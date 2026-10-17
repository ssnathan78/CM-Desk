import { FormControl, FormControlLabel, Grid, Radio, RadioGroup, Typography } from "@mui/material"
import React from "react"
import { PRODUCT_TYPE } from "../../lib/constants"
import { labelFor } from "../../lib/ui/labels"
import FieldRow from "../forms/FieldRow"

const ProductTypeComponent = ({ state, onChange }) => {
  const productTypes = [PRODUCT_TYPE.MIS, PRODUCT_TYPE.NRML]
  return (
    <Grid size={12}>
      <FieldRow label="Product" wide>
        <FormControl component="fieldset" sx={{ width: "100%" }}>
          <RadioGroup
            aria-label="productType"
            name="productType"
            value={state.productType}
            onChange={e => onChange({ productType: e.target.value as PRODUCT_TYPE })}
            row
          >
            {productTypes.map(productType => (
              <FormControlLabel
                key={productType}
                value={productType}
                control={<Radio size="small" />}
                label={<Typography variant="body2">{labelFor(productType)}</Typography>}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </FieldRow>
    </Grid>
  )
}

export default ProductTypeComponent

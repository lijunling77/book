/**
 * 前端表单校验规则
 */

import type { Rule } from 'antd/es/form';

/** 必填项校验 */
export const requiredRule = (label: string): Rule => ({
  required: true,
  message: `请输入${label}`,
});

/** 必选项校验 */
export const requiredSelectRule = (label: string): Rule => ({
  required: true,
  message: `请选择${label}`,
});

/** 正整数校验 */
export const positiveIntegerRule: Rule = {
  type: 'number',
  min: 1,
  message: '请输入大于零的整数',
  transform: (value) => (value ? Number(value) : value),
};

/** 非负数校验 */
export const nonNegativeNumberRule: Rule = {
  type: 'number',
  min: 0,
  message: '请输入不小于零的数值',
  transform: (value) => (value ? Number(value) : value),
};

/** 数量校验规则集 */
export const quantityRules: Rule[] = [
  { required: true, message: '请输入数量' },
  { type: 'number', min: 1, message: '数量必须大于零' },
];

/** 价格校验规则集 */
export const priceRules: Rule[] = [
  { required: true, message: '请输入价格' },
  { type: 'number', min: 0, message: '价格不能为负数' },
];

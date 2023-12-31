import { Helmet } from 'react-helmet-async';
import { filter } from 'lodash';
import { sentenceCase } from 'change-case';
import { forwardRef, useEffect, useState } from 'react';
// @mui
import {
  Card,
  Table,
  Stack,
  Paper,
  Avatar,
  Popover,
  Checkbox,
  TableRow,
  MenuItem,
  TableBody,
  TableCell,
  Container,
  Typography,
  IconButton,
  TableContainer,
  TablePagination,
  Tooltip,
  InputAdornment,
  styled,
  OutlinedInput,
  Toolbar,
  alpha,
  Snackbar,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
// components
import axios from 'axios';
import Label from '../components/label';
import Iconify from '../components/iconify';
import Scrollbar from '../components/scrollbar';
import supabase from '../config/SupabaseClient';
// sections
// mock
import USERLIST from '../_mock/user';
import { LeadListHead } from '../sections/@dashboard/lead';
import CreateLeadModal from '../components/modals/lead/create-lead/CreateLeadModal';
import EditLeadStatus from '../components/modals/lead/edit-lead/EditLeadStatus';
import ImportLeadsModal from '../components/modals/lead/import-leads/ImportLeadsModal';
import LeadDetailsModal from '../components/modals/lead/lead-details/LeadDetailsModal';
import { missedLeads } from '../data/missedLeads';
import EditInventoryStatus from '../components/modals/inventory/edit-inventory/EditInventoryStatus';
import CreateItemModal from '../components/modals/inventory/create-item/CreateItemModal';
// ----------------------------------------------------------------------

const Alert = forwardRef((props, ref) => <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />);

const TABLE_HEAD = [
  { id: 'product', label: 'Product', alignRight: false },
  { id: 'color', label: 'Color', alignRight: false },
  { id: 'size', label: 'Size', alignRight: false },
  { id: 'stock', label: 'Stock', alignRight: false },
  // { id: 'status', label: 'Status', alignRight: false },
  { id: '', alignRight: false },
  { id: '' },
];

const statusColors = {
  initial: 'info',
  canceled: 'error',
  confirmed: 'success',
  'not-responding': 'warning',
  unreachable: 'warning',
  busy: 'warning',
  reported: 'secondary',
  other: 'secondary',
};

// ----------------------------------------------------------------------

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function applySortFilter(array, comparator, query) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  if (query) {
    return filter(array, (_user) => _user.name.toLowerCase().indexOf(query.toLowerCase()) !== -1);
  }
  return stabilizedThis.map((el) => el[0]);
}

const StyledRoot = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 1, 0, 3),
  paddingTop: 18,
  paddingBottom: 18,
}));

const StyledSearch = styled(OutlinedInput)(({ theme }) => ({
  width: 240,
  marginTop: 10,
  transition: theme.transitions.create(['box-shadow', 'width'], {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.shorter,
  }),
  '&.Mui-focused': {
    width: 320,
    boxShadow: theme.customShadows.z8,
  },
  '& fieldset': {
    borderWidth: `1px !important`,
    borderColor: `${alpha(theme.palette.grey[500], 0.32)} !important`,
  },
}));

export default function InventoryPage() {
  const [open, setOpen] = useState(null);

  const [page, setPage] = useState(0);

  const [order, setOrder] = useState('asc');

  const [selected, setSelected] = useState([]);
  const [triggerFetch, setTriggerFetch] = useState();
  const [orderBy, setOrderBy] = useState('name');

  const [filterName, setFilterName] = useState('');
  const [isError, setIsError] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [leads, setLeads] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [rowsCount, setRowsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [userSession, setUserSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState('');
  useEffect(() => {
    console.log(selected);
  }, [selected]);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  };

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = leads.map((n) => n.name);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event, name) => {
    const selectedIndex = selected.indexOf(name);
    let newSelected = [];
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, name);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1));
    }
    setSelected(newSelected);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  };

  const handleFilterByName = (event) => {
    setPage(0);
    setFilterName(event.target.value);
  };

  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - leads.length) : 0;

  const filteredLeads = applySortFilter(leads, getComparator(order, orderBy), filterName);

  const isNotFound = !filteredLeads.length && !!filterName;

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setIsLoading(true);
        const { data: dataAuth, error: errorAuth } = await supabase.auth.getSession();
        const { email } = dataAuth.session.user;
        const { data: dataUser, error: errorUser } = await supabase.from('users').select().eq('email', email).single();

        if (dataUser) {
          console.log('data user: ', dataUser);
        }

        if (errorUser) {
          console.log('error user: ', errorUser);
        }

        let count;
        let data;
        let error;
        if (filterProduct === '') {
          const {
            count: countFilter,
            data: dataFilter,
            error: errorFilter,
          } = await supabase.rpc('get_items_inventory').select('*', { count: 'exact' });
          count = countFilter;
          data = dataFilter;
          error = errorFilter;
        } else {
          const {
            count: countFilter,
            data: dataFilter,
            error: errorFilter,
          } = await supabase
            .rpc('get_items_inventory_with_product_filter', {
              product_in: filterProduct,
            })
            .select('*', { count: 'exact' });
          count = countFilter;
          data = dataFilter;
          error = errorFilter;
        }
        // .range(page * rowsPerPage, page * rowsPerPage + rowsPerPage - 1);
        console.log('couuuunt:', count);
        if (data) {
          const fetchedInventory = data.map((row) => ({
            id: row.id,
            itemId: row.id,
            product: row.product,
            color: row.color,
            size: row.size,
            thumbnail: row.thumbnail,
            quantity: row.quantity,
          }));
          // const fetchedInventory = data.map((row) => ({
          //   id: row.id,
          //   itemId: row.items.id,
          //   product: row.items.product,
          //   color: row.items.color,
          //   size: row.items.size,
          //   thumbnail: row.items.thumbnail,
          //   quantity: row.quantity,
          // }));

          setRowsCount(count);
          setLeads(fetchedInventory);
          console.log('data is join', fetchedInventory);
        }
        if (error) {
          console.log('something went wrong', error);
        }

        setIsLoading(false);
      } catch (error) {
        console.log('something was wrong', error);
        setIsLoading(false);
      }
    };
    fetchLeads();
  }, [rowsPerPage, page, triggerFetch, filterStatus, filterProduct]);
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        console.log('geooooooo', data.session);
        if (data && data.session) {
          setUserSession(data.session);

          const { data: dataFetch, error: errorFetch } = await supabase
            .from('users')
            .select('role')
            .eq('email', data.session.user.email);

          let role = '';

          if (dataFetch && dataFetch[0]) role = dataFetch[0].role;
          setCurrentUserRole(role);
        }
      } catch (error) {
        console.log('something went wrong ', error);
      }
    };
    getSession();
  }, []);

  useEffect(() => {
    const getItems = async () => {
      try {
        const { data, error } = await supabase.rpc('get_available_products').select('*', { count: 'exact' });
        setProducts(data);
      } catch (error) {
        console.log('something went wrong xx', error);
      }
    };
    getItems();
  }, []);

  const handleDeleteItem = async (id) => {
    try {
      alert('are you sure about deleting the item?');
      const { error } = await supabase.from('items').delete().eq('id', id);

      if (error) {
        setFeedback('a Problem accured when removing the item');
        setIsError(true);
      } else {
        setFeedback('Item removed successfully!');
        setIsError(false);
        setTriggerFetch(Math.random());
      }
      setOpen(true);
    } catch (error) {
      console.log(error);
      setFeedback('a Problem accured!');
      setIsError(true);
      setOpen(true);
    }
  };

  return (
    <>
      <Helmet>
        <title> Inventory </title>
      </Helmet>

      <Container>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={5}>
          <Typography variant="h4" gutterBottom>
            Inventory
          </Typography>
          <Stack direction="row">
            <CreateItemModal handleTriggerFetch={(val) => setTriggerFetch(val)} />
          </Stack>
        </Stack>

        <Card>
          <StyledRoot
            sx={{
              ...(selected.length > 0 && {
                color: 'primary.main',
                bgcolor: 'primary.lighter',
              }),
            }}
          >
            {selected.length > 0 ? (
              <Typography component="div" variant="subtitle1">
                {selected.length} selected
              </Typography>
            ) : (
              // <form onSubmit={handleSearchInDb}>
              <div>
                <FormControl fullWidth style={{ width: 240, marginLeft: 10, marginTop: 10, marginBottom: 10 }}>
                  <InputLabel>Filter Product</InputLabel>
                  <Select
                    value={filterProduct}
                    label="filter-product"
                    onChange={(e) => {
                      setFilterProduct(e.target.value);
                      setPage(0);
                    }}
                  >
                    <MenuItem value={''}>All</MenuItem>
                    {products.map((item) => (
                      <MenuItem key={item.key} value={item.key}>
                        {item.key}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {/* <FormControl fullWidth style={{ width: 240, marginLeft: 10, marginTop: 10 }}>
                  <InputLabel>Filter Status</InputLabel>
                  <Select
                    value={filterStatus}
                    label="filter-status"
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setPage(0);
                    }}
                  >
                    <MenuItem value={''}>All</MenuItem>
                    <MenuItem value={'initial'}>Initial</MenuItem>
                    <MenuItem value={'confirmed'}>Confirmed</MenuItem>
                    <MenuItem value={'not-responding'}>Not Responding</MenuItem>
                    <MenuItem value={'unreachable'}>Unreachable</MenuItem>
                    <MenuItem value={'canceled'}>Canceled</MenuItem>
                    <MenuItem value={'busy'}>Busy</MenuItem>
                    <MenuItem value={'reported'}>Reported</MenuItem>
                    <MenuItem value={'other'}>other</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth style={{ width: 240, marginLeft: 10, marginTop: 10, marginBottom: 10 }}>
                  <InputLabel>Filter Product</InputLabel>
                  <Select
                    value={filterProduct}
                    label="filter-product"
                    onChange={(e) => {
                      setFilterProduct(e.target.value);
                      setPage(0);
                    }}
                  >
                    <MenuItem value={''}>All</MenuItem>
                    <MenuItem value={'oil'}>Oil</MenuItem>
                    <MenuItem value={'shoes'}>Shoes</MenuItem>
                    <MenuItem value={'outfit'}>Outfit</MenuItem>
                  </Select>
                </FormControl> */}
              </div>
              // <button
              // </form>
            )}

            {selected.length > 0 ? (
              <Tooltip title="Delete">
                <IconButton>
                  <Iconify icon="eva:trash-2-fill" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Filter list">
                <IconButton>
                  <Iconify icon="ic:round-filter-list" />
                </IconButton>
              </Tooltip>
            )}
          </StyledRoot>

          <Scrollbar>
            <TableContainer sx={{ minWidth: 800 }}>
              <Table>
                <LeadListHead
                  order={order}
                  orderBy={orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={leads.length}
                  numSelected={selected.length}
                  onRequestSort={handleRequestSort}
                  onSelectAllClick={handleSelectAllClick}
                />
                <TableBody>
                  {isLoading ? (
                    <>
                      <TableRow>
                        <TableCell>
                          <p> </p>
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={2}>
                            <Skeleton variant="circular" width={20} height={20} />
                            <Skeleton variant="circular" width={20} height={20} />
                          </Stack>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <p> </p>
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={2}>
                            <Skeleton variant="circular" width={20} height={20} />
                            <Skeleton variant="circular" width={20} height={20} />
                          </Stack>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <p> </p>
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Skeleton variant="text" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={2}>
                            <Skeleton variant="circular" width={20} height={20} />
                            <Skeleton variant="circular" width={20} height={20} />
                          </Stack>
                        </TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <>
                      {filteredLeads.map((row) => {
                        const { id, product, thumbnail, color, itemId, size, quantity } = row;
                        const selectedLead = selected.indexOf(id) !== -1;

                        return (
                          <TableRow hover key={id + page} tabIndex={-1} role="checkbox" selected={selectedLead}>
                            <TableCell padding="checkbox">
                              <Checkbox checked={selectedLead} onChange={(event) => handleClick(event, id)} />
                            </TableCell>

                            <TableCell component="th" scope="row" padding="none">
                              <Stack direction="row" alignItems="center" spacing={2}>
                                <Avatar alt={id} src={`https://api.dicebear.com/5.x/fun-emoji/svg?seed=${id}`} />
                                <Typography variant="subtitle2" noWrap>
                                  {product}
                                </Typography>
                              </Stack>
                            </TableCell>

                            <TableCell align="left">{color}</TableCell>

                            <TableCell align="left">{size}</TableCell>

                            <TableCell align="left">{quantity}</TableCell>

                            {/* <TableCell align="left">
                              <Label color={statusColors[status]}>{sentenceCase(status)}</Label>
                            </TableCell> */}
                            <TableCell align="right">
                              <EditInventoryStatus
                                id={id}
                                itemIdAttr={itemId}
                                itemColorAttr={color}
                                itemSizeAttr={size}
                                itemProductAttr={product}
                                inventoryAttr={quantity}
                                thumbnailAttr={thumbnail}
                                handleTriggerFetch={(val) => setTriggerFetch(val)}
                              />
                            </TableCell>

                            <TableCell align="right">
                              <Stack direction="row">
                                {currentUserRole === 'admin' && (
                                  <IconButton size="large" color="inherit" onClick={() => handleDeleteItem(itemId)}>
                                    <Iconify icon={'eva:trash-2-outline'} />
                                  </IconButton>
                                )}
                                {/* <LeadDetailsModal
                                  id={id}
                                  communeAttr={commune}
                                  wilayaAttr={wilaya}
                                  addressAttr={address}
                                  productAttr={product}
                                  firstNameAttr={firstName}
                                  lastNameAttr={lastName}
                                  commentAttr={comment}
                                  statusAttr={status}
                                  phoneAttr={phone}
                                  createdAtAttr={createdAt}
                                  colorAttr={color}
                                  sizeAttr={size}
                                /> */}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  )}

                  {/* {emptyRows > 0 && (
                    <TableRow style={{ height: 53 * emptyRows }}>
                      <TableCell colSpan={6} />
                    </TableRow>
                  )} */}
                </TableBody>

                {isNotFound && (
                  <TableBody>
                    <TableRow>
                      <TableCell align="center" colSpan={6} sx={{ py: 3 }}>
                        <Paper
                          sx={{
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="h6" paragraph>
                            Not found
                          </Typography>

                          <Typography variant="body2">
                            No results found for &nbsp;
                            <strong>&quot;{filterName}&quot;</strong>.
                            <br /> Try checking for typos or using complete words.
                          </Typography>
                        </Paper>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                )}
              </Table>
            </TableContainer>
          </Scrollbar>

          <TablePagination
            rowsPerPageOptions={[25, 50, 100]}
            component="div"
            count={rowsCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Card>
      </Container>

      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleClose} severity={isError ? 'error' : 'success'} sx={{ width: '100%' }}>
          {feedback}
        </Alert>
      </Snackbar>
    </>
  );
}

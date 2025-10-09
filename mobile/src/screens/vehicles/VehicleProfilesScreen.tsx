import React, { useState, useEffect } from 'react';import React, { useState, useEffect } from 'react';

import {import {

    StyleSheet,  StyleSheet,

    View,  View,

    Text,  Text,

    TouchableOpacity,  TouchableOpacity,

    ScrollView,  ScrollView,

    Alert,  Alert,

    RefreshControl,  RefreshControl,

} from 'react-native';} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { StatusBar } from 'expo-status-bar';import { StatusBar } from 'expo-status-bar';

import { MaterialIcons } from '@expo/vector-icons';import { MaterialIcons } from '@expo/vector-icons';



import { Colors } from '../../constants/Colors';import { Colors } from '../../constants/Colors';

import { RootStackParamList } from '../../navigation/types';import { RootStackParamList } from '../../navigation/types';

import { useAuth } from '../../context/AuthContext';import { useAuth } from '../../context/AuthContext';



// Types for vehicle management// Types for vehicle management

interface UserVehicle {interface UserVehicle {

    id: string;  id: string;

    user_id: string;  user_id: string;

    vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle';  vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle';

    make: string;  make: string;

    model: string;  model: string;

    year: number;  year: number;

    color: string | null;  color: string | null;

    license_plate: string | null;  license_plate: string | null;

    nickname: string | null;  nickname: string | null;

    is_primary: boolean;  is_primary: boolean;

    is_active: boolean;  is_active: boolean;

    created_at: string;  created_at: string;

    updated_at: string;  updated_at: string;

}}



type VehicleProfilesNavigationProp = NativeStackScreenProps<type VehicleProfilesNavigationProp = NativeStackScreenProps<

    RootStackParamList,  RootStackParamList,

    'VehicleProfiles'  'VehicleProfiles'

>['navigation'];>['navigation'];



interface VehicleProfilesScreenProps {interface VehicleProfilesScreenProps {

    navigation: VehicleProfilesNavigationProp;  navigation: VehicleProfilesNavigationProp;

}}



export default function VehicleProfilesScreen({export default function VehicleProfilesScreen({

    navigation,  navigation,

}: VehicleProfilesScreenProps) {}: VehicleProfilesScreenProps) {

    const { userProfile } = useAuth();  const { userProfile } = useAuth();

    const [vehicles, setVehicles] = useState<UserVehicle[]>([]);  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);

    const [loading, setLoading] = useState(true);  const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);  const [refreshing, setRefreshing] = useState(false);



    // Mock API call - replace with actual API integration  // Mock API call - replace with actual API integration

    const fetchVehicles = async () => {  const fetchVehicles = async () => {

        try {    try {

            // Simulate API call      // Simulate API call

            await new Promise(resolve => setTimeout(resolve, 1000));      await new Promise(resolve => setTimeout(resolve, 1000));

                  

            // Mock data for demonstration      // Mock data for demonstration

            const mockVehicles: UserVehicle[] = [      const mockVehicles: UserVehicle[] = [

                {        {

                    id: '1',          id: '1',

                    user_id: userProfile?.id || '',          user_id: userProfile?.id || '',

                    vehicle_type: 'car',          vehicle_type: 'car',

                    make: 'Honda',          make: 'Honda',

                    model: 'Civic',          model: 'Civic',

                    year: 2020,          year: 2020,

                    color: 'Silver',          color: 'Silver',

                    license_plate: 'ABC123',          license_plate: 'ABC123',

                    nickname: 'My Daily Driver',          nickname: 'My Daily Driver',

                    is_primary: true,          is_primary: true,

                    is_active: true,          is_active: true,

                    created_at: new Date().toISOString(),          created_at: new Date().toISOString(),

                    updated_at: new Date().toISOString(),          updated_at: new Date().toISOString(),

                },        },

                {        {

                    id: '2',          id: '2',

                    user_id: userProfile?.id || '',          user_id: userProfile?.id || '',

                    vehicle_type: 'truck',          vehicle_type: 'truck',

                    make: 'Ford',          make: 'Ford',

                    model: 'F-150',          model: 'F-150',

                    year: 2019,          year: 2019,

                    color: 'Blue',          color: 'Blue',

                    license_plate: 'XYZ789',          license_plate: 'XYZ789',

                    nickname: 'Work Truck',          nickname: 'Work Truck',

                    is_primary: false,          is_primary: false,

                    is_active: true,          is_active: true,

                    created_at: new Date().toISOString(),          created_at: new Date().toISOString(),

                    updated_at: new Date().toISOString(),          updated_at: new Date().toISOString(),

                },        },

            ];      ];

                  

            setVehicles(mockVehicles);      setVehicles(mockVehicles);

        } catch (error) {    } catch (error) {

            console.error('Error fetching vehicles:', error);      console.error('Error fetching vehicles:', error);

            Alert.alert('Error', 'Failed to load vehicles');      Alert.alert('Error', 'Failed to load vehicles');

        } finally {    } finally {

            setLoading(false);      setLoading(false);

            setRefreshing(false);      setRefreshing(false);

        }    }

    };  };



    useEffect(() => {  useEffect(() => {

        fetchVehicles();    fetchVehicles();

    }, []);  }, []);



    const handleRefresh = () => {  const handleRefresh = () => {

        setRefreshing(true);    setRefreshing(true);

        fetchVehicles();    fetchVehicles();

    };  };



    const handleAddVehicle = () => {  const handleAddVehicle = () => {

        navigation.navigate('AddEditVehicle');    navigation.navigate('AddEditVehicle');

    };  };



    const handleEditVehicle = (vehicle: UserVehicle) => {  const handleEditVehicle = (vehicle: UserVehicle) => {

        navigation.navigate('AddEditVehicle', { vehicle });    navigation.navigate('AddEditVehicle', { vehicle });

    };  };



    const handleDeleteVehicle = (vehicle: UserVehicle) => {  const handleDeleteVehicle = (vehicle: UserVehicle) => {

        Alert.alert(    Alert.alert(

            'Delete Vehicle',      'Delete Vehicle',

            `Are you sure you want to delete ${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}?`,      `Are you sure you want to delete ${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}?`,

            [      [

                { text: 'Cancel', style: 'cancel' },        { text: 'Cancel', style: 'cancel' },

                {        {

                    text: 'Delete',          text: 'Delete',

                    style: 'destructive',          style: 'destructive',

                    onPress: () => deleteVehicle(vehicle.id),          onPress: () => deleteVehicle(vehicle.id),

                },        },

            ]      ]

        );    );

    };  };



    const deleteVehicle = async (vehicleId: string) => {  const deleteVehicle = async (vehicleId: string) => {

        try {    try {

            // Simulate API call      // Simulate API call

            await new Promise(resolve => setTimeout(resolve, 500));      await new Promise(resolve => setTimeout(resolve, 500));

                  

            setVehicles(prev => prev.filter(v => v.id !== vehicleId));      setVehicles(prev => prev.filter(v => v.id !== vehicleId));

            Alert.alert('Success', 'Vehicle deleted successfully');      Alert.alert('Success', 'Vehicle deleted successfully');

        } catch (error) {    } catch (error) {

            console.error('Error deleting vehicle:', error);      console.error('Error deleting vehicle:', error);

            Alert.alert('Error', 'Failed to delete vehicle');      Alert.alert('Error', 'Failed to delete vehicle');

        }    }

    };  };



    const handleSetPrimary = async (vehicle: UserVehicle) => {  const handleSetPrimary = async (vehicle: UserVehicle) => {

        try {    try {

            // Simulate API call      // Simulate API call

            await new Promise(resolve => setTimeout(resolve, 500));      await new Promise(resolve => setTimeout(resolve, 500));

                  

            setVehicles(prev =>       setVehicles(prev => 

                prev.map(v => ({        prev.map(v => ({

                    ...v,          ...v,

                    is_primary: v.id === vehicle.id,          is_primary: v.id === vehicle.id,

                }))        }))

            );      );

                  

            Alert.alert('Success', `${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`} set as primary vehicle`);      Alert.alert('Success', `${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`} set as primary vehicle`);

        } catch (error) {    } catch (error) {

            console.error('Error setting primary vehicle:', error);      console.error('Error setting primary vehicle:', error);

            Alert.alert('Error', 'Failed to set primary vehicle');      Alert.alert('Error', 'Failed to set primary vehicle');

        }    }

    };  };



    const getVehicleTypeIcon = (type: string) => {  const getVehicleTypeIcon = (type: string) => {

        switch (type) {    switch (type) {

            case 'car':      case 'car':

                return 'directions-car';        return 'directions-car';

            case 'truck':      case 'truck':

                return 'local-shipping';        return 'local-shipping';

            case 'van':      case 'van':

                return 'airport-shuttle';        return 'airport-shuttle';

            case 'motorcycle':      case 'motorcycle':

                return 'motorcycle';        return 'motorcycle';

            default:      default:

                return 'directions-car';        return 'directions-car';

        }    }

    };  };



    const formatVehicleTitle = (vehicle: UserVehicle) => {  const formatVehicleTitle = (vehicle: UserVehicle) => {

        return vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;    return vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

    };  };



    const formatVehicleSubtitle = (vehicle: UserVehicle) => {  const formatVehicleSubtitle = (vehicle: UserVehicle) => {

        const parts = [];    const parts = [];

        if (vehicle.color) parts.push(vehicle.color);    if (vehicle.color) parts.push(vehicle.color);

        if (!vehicle.nickname) {    if (!vehicle.nickname) {

            // If no nickname, show make/model in subtitle      // If no nickname, show make/model in subtitle

            parts.push(`${vehicle.make} ${vehicle.model}`);      parts.push(`${vehicle.make} ${vehicle.model}`);

        } else {    } else {

            // If has nickname, show year/make/model      // If has nickname, show year/make/model

            parts.push(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);      parts.push(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);

        }    }

        if (vehicle.license_plate) parts.push(vehicle.license_plate);    if (vehicle.license_plate) parts.push(vehicle.license_plate);

        return parts.join(' • ');    return parts.join(' ΓÇó ');

    };  };



    if (loading) {  if (loading) {

        return (    return (

            <View style={styles.container}>      <View style={styles.container}>

                <StatusBar style="dark" />        <StatusBar style="dark" />

                <View style={styles.header}>        <View style={styles.header}>

                    <TouchableOpacity          <TouchableOpacity

                        style={styles.backButton}            style={styles.backButton}

                        onPress={() => navigation.goBack()}            onPress={() => navigation.goBack()}

                    >          >

                        <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />            <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />

                    </TouchableOpacity>          </TouchableOpacity>

                    <Text style={styles.title}>My Vehicles</Text>          <Text style={styles.title}>My Vehicles</Text>

                </View>        </View>

                <View style={styles.loadingContainer}>        <View style={styles.loadingContainer}>

                    <Text style={styles.loadingText}>Loading vehicles...</Text>          <Text style={styles.loadingText}>Loading vehicles...</Text>

                </View>        </View>

            </View>      </View>

        );    );

    }  }



    return (  return (

        <View style={styles.container}>    <View style={styles.container}>

            <StatusBar style="dark" />      <StatusBar style="dark" />



            {/* Header */}      {/* Header */}

            <View style={styles.header}>      <View style={styles.header}>

                <TouchableOpacity        <TouchableOpacity

                    style={styles.backButton}          style={styles.backButton}

                    onPress={() => navigation.goBack()}          onPress={() => navigation.goBack()}

                >        >

                    <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />

                </TouchableOpacity>        </TouchableOpacity>

                <Text style={styles.title}>My Vehicles</Text>        <Text style={styles.title}>My Vehicles</Text>

                <TouchableOpacity        <TouchableOpacity

                    style={styles.addButton}          style={styles.addButton}

                    onPress={handleAddVehicle}          onPress={handleAddVehicle}

                >        >

                    <MaterialIcons name="add" size={24} color={Colors.text.inverse} />          <MaterialIcons name="add" size={24} color={Colors.text.inverse} />

                </TouchableOpacity>        </TouchableOpacity>

            </View>      </View>



            <ScrollView      <ScrollView

                style={styles.content}        style={styles.content}

                showsVerticalScrollIndicator={false}        showsVerticalScrollIndicator={false}

                refreshControl={        refreshControl={

                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />

                }        }

            >      >

                {vehicles.length === 0 ? (        {vehicles.length === 0 ? (

                    <View style={styles.emptyContainer}>          <View style={styles.emptyContainer}>

                        <MaterialIcons            <MaterialIcons

                            name="directions-car"              name="directions-car"

                            size={64}              size={64}

                            color={Colors.text.secondary}              color={Colors.text.secondary}

                        />            />

                        <Text style={styles.emptyTitle}>No Vehicles Added</Text>            <Text style={styles.emptyTitle}>No Vehicles Added</Text>

                        <Text style={styles.emptyDescription}>            <Text style={styles.emptyDescription}>

                            Add your vehicles to make shipment booking faster and easier.              Add your vehicles to make shipment booking faster and easier.

                        </Text>            </Text>

                        <TouchableOpacity            <TouchableOpacity

                            style={styles.addVehicleButton}              style={styles.addVehicleButton}

                            onPress={handleAddVehicle}              onPress={handleAddVehicle}

                        >            >

                            <MaterialIcons name="add" size={24} color={Colors.text.inverse} />              <MaterialIcons name="add" size={24} color={Colors.text.inverse} />

                            <Text style={styles.addVehicleButtonText}>Add Your First Vehicle</Text>              <Text style={styles.addVehicleButtonText}>Add Your First Vehicle</Text>

                        </TouchableOpacity>            </TouchableOpacity>

                    </View>          </View>

                ) : (        ) : (

                    vehicles.map((vehicle) => (          vehicles.map((vehicle) => (

                        <View key={vehicle.id} style={styles.vehicleCard}>            <View key={vehicle.id} style={styles.vehicleCard}>

                            <View style={styles.vehicleHeader}>              <View style={styles.vehicleHeader}>

                                <View style={styles.vehicleIconContainer}>                <View style={styles.vehicleIconContainer}>

                                    <MaterialIcons                  <MaterialIcons

                                        name={getVehicleTypeIcon(vehicle.vehicle_type) as any}                    name={getVehicleTypeIcon(vehicle.vehicle_type) as any}

                                        size={32}                    size={32}

                                        color={Colors.primary}                    color={Colors.primary}

                                    />                  />

                                </View>                </View>

                                <View style={styles.vehicleInfo}>                <View style={styles.vehicleInfo}>

                                    <View style={styles.vehicleTitleRow}>                  <View style={styles.vehicleTitleRow}>

                                        <Text style={styles.vehicleTitle}>                    <Text style={styles.vehicleTitle}>

                                            {formatVehicleTitle(vehicle)}                      {formatVehicleTitle(vehicle)}

                                        </Text>                    </Text>

                                        {vehicle.is_primary && (                    {vehicle.is_primary && (

                                            <View style={styles.primaryBadge}>                      <View style={styles.primaryBadge}>

                                                <Text style={styles.primaryBadgeText}>PRIMARY</Text>                        <Text style={styles.primaryBadgeText}>PRIMARY</Text>

                                            </View>                      </View>

                                        )}                    )}

                                    </View>                  </View>

                                    <Text style={styles.vehicleSubtitle}>                  <Text style={styles.vehicleSubtitle}>

                                        {formatVehicleSubtitle(vehicle)}                    {formatVehicleSubtitle(vehicle)}

                                    </Text>                  </Text>

                                </View>                </View>

                                <TouchableOpacity                <TouchableOpacity

                                    style={styles.menuButton}                  style={styles.menuButton}

                                    onPress={() => {                  onPress={() => {

                                        // Show action sheet or menu                    // Show action sheet or menu

                                        Alert.alert(                    Alert.alert(

                                            'Vehicle Options',                      'Vehicle Options',

                                            `Options for ${formatVehicleTitle(vehicle)}`,                      `Options for ${formatVehicleTitle(vehicle)}`,

                                            [                      [

                                                { text: 'Cancel', style: 'cancel' },                        { text: 'Cancel', style: 'cancel' },

                                                { text: 'Edit', onPress: () => handleEditVehicle(vehicle) },                        { text: 'Edit', onPress: () => handleEditVehicle(vehicle) },

                                                ...(vehicle.is_primary ? [] : [                        ...(vehicle.is_primary ? [] : [

                                                    { text: 'Set as Primary', onPress: () => handleSetPrimary(vehicle) }                          { text: 'Set as Primary', onPress: () => handleSetPrimary(vehicle) }

                                                ]),                        ]),

                                                {                         { 

                                                    text: 'Delete',                           text: 'Delete', 

                                                    style: 'destructive',                          style: 'destructive',

                                                    onPress: () => handleDeleteVehicle(vehicle)                           onPress: () => handleDeleteVehicle(vehicle) 

                                                },                        },

                                            ]                      ]

                                        );                    );

                                    }}                  }}

                                >                >

                                    <MaterialIcons name="more-vert" size={24} color={Colors.text.secondary} />                  <MaterialIcons name="more-vert" size={24} color={Colors.text.secondary} />

                                </TouchableOpacity>                </TouchableOpacity>

                            </View>              </View>



                            <View style={styles.vehicleActions}>              <View style={styles.vehicleActions}>

                                <TouchableOpacity                <TouchableOpacity

                                    style={styles.actionButton}                  style={styles.actionButton}

                                    onPress={() => handleEditVehicle(vehicle)}                  onPress={() => handleEditVehicle(vehicle)}

                                >                >

                                    <MaterialIcons name="edit" size={20} color={Colors.primary} />                  <MaterialIcons name="edit" size={20} color={Colors.primary} />

                                    <Text style={styles.actionButtonText}>Edit</Text>                  <Text style={styles.actionButtonText}>Edit</Text>

                                </TouchableOpacity>                </TouchableOpacity>

                                                

                                {!vehicle.is_primary && (                {!vehicle.is_primary && (

                                    <TouchableOpacity                  <TouchableOpacity

                                        style={styles.actionButton}                    style={styles.actionButton}

                                        onPress={() => handleSetPrimary(vehicle)}                    onPress={() => handleSetPrimary(vehicle)}

                                    >                  >

                                        <MaterialIcons name="star-border" size={20} color={Colors.primary} />                    <MaterialIcons name="star-border" size={20} color={Colors.primary} />

                                        <Text style={styles.actionButtonText}>Set Primary</Text>                    <Text style={styles.actionButtonText}>Set Primary</Text>

                                    </TouchableOpacity>                  </TouchableOpacity>

                                )}                )}

                            </View>              </View>

                        </View>            </View>

                    ))          ))

                )}        )}



                {vehicles.length > 0 && (        {vehicles.length > 0 && (

                    <TouchableOpacity          <TouchableOpacity

                        style={styles.addAnotherButton}            style={styles.addAnotherButton}

                        onPress={handleAddVehicle}            onPress={handleAddVehicle}

                    >          >

                        <MaterialIcons name="add" size={24} color={Colors.primary} />            <MaterialIcons name="add" size={24} color={Colors.primary} />

                        <Text style={styles.addAnotherButtonText}>Add Another Vehicle</Text>            <Text style={styles.addAnotherButtonText}>Add Another Vehicle</Text>

                    </TouchableOpacity>          </TouchableOpacity>

                )}        )}

            </ScrollView>      </ScrollView>

        </View>    </View>

    );  );

}}



const styles = StyleSheet.create({const styles = StyleSheet.create({

    container: {  container: {

        flex: 1,    flex: 1,

        backgroundColor: Colors.background,    backgroundColor: Colors.background,

    },  },

    header: {  header: {

        backgroundColor: Colors.primary,    backgroundColor: Colors.primary,

        paddingTop: 60,    paddingTop: 60,

        paddingBottom: 20,    paddingBottom: 20,

        paddingHorizontal: 24,    paddingHorizontal: 24,

        flexDirection: 'row',    flexDirection: 'row',

        alignItems: 'center',    alignItems: 'center',

        justifyContent: 'space-between',    justifyContent: 'space-between',

    },  },

    backButton: {  backButton: {

        padding: 8,    padding: 8,

        marginLeft: -8,    marginLeft: -8,

    },  },

    title: {  title: {

        fontSize: 24,    fontSize: 24,

        fontWeight: '700',    fontWeight: '700',

        color: Colors.text.inverse,    color: Colors.text.inverse,

        flex: 1,    flex: 1,

        textAlign: 'center',    textAlign: 'center',

        marginHorizontal: 16,    marginHorizontal: 16,

    },  },

    addButton: {  addButton: {

        padding: 8,    padding: 8,

        marginRight: -8,    marginRight: -8,

    },  },

    content: {  content: {

        flex: 1,    flex: 1,

        paddingHorizontal: 24,    paddingHorizontal: 24,

        paddingTop: 24,    paddingTop: 24,

    },  },

    loadingContainer: {  loadingContainer: {

        flex: 1,    flex: 1,

        justifyContent: 'center',    justifyContent: 'center',

        alignItems: 'center',    alignItems: 'center',

    },  },

    loadingText: {  loadingText: {

        fontSize: 16,    fontSize: 16,

        color: Colors.text.secondary,    color: Colors.text.secondary,

    },  },

    emptyContainer: {  emptyContainer: {

        flex: 1,    flex: 1,

        justifyContent: 'center',    justifyContent: 'center',

        alignItems: 'center',    alignItems: 'center',

        paddingVertical: 100,    paddingVertical: 100,

    },  },

    emptyTitle: {  emptyTitle: {

        fontSize: 20,    fontSize: 20,

        fontWeight: '600',    fontWeight: '600',

        color: Colors.text.primary,    color: Colors.text.primary,

        marginTop: 16,    marginTop: 16,

        marginBottom: 8,    marginBottom: 8,

    },  },

    emptyDescription: {  emptyDescription: {

        fontSize: 16,    fontSize: 16,

        color: Colors.text.secondary,    color: Colors.text.secondary,

        textAlign: 'center',    textAlign: 'center',

        marginBottom: 32,    marginBottom: 32,

        lineHeight: 24,    lineHeight: 24,

    },  },

    addVehicleButton: {  addVehicleButton: {

        backgroundColor: Colors.primary,    backgroundColor: Colors.primary,

        borderRadius: 12,    borderRadius: 12,

        paddingVertical: 16,    paddingVertical: 16,

        paddingHorizontal: 24,    paddingHorizontal: 24,

        flexDirection: 'row',    flexDirection: 'row',

        alignItems: 'center',    alignItems: 'center',

        gap: 8,    gap: 8,

    },  },

    addVehicleButtonText: {  addVehicleButtonText: {

        color: Colors.text.inverse,    color: Colors.text.inverse,

        fontSize: 16,    fontSize: 16,

        fontWeight: '600',    fontWeight: '600',

    },  },

    vehicleCard: {  vehicleCard: {

        backgroundColor: Colors.surface,    backgroundColor: Colors.surface,

        borderRadius: 12,    borderRadius: 12,

        padding: 20,    padding: 20,

        marginBottom: 16,    marginBottom: 16,

    },  },

    vehicleHeader: {  vehicleHeader: {

        flexDirection: 'row',    flexDirection: 'row',

        alignItems: 'flex-start',    alignItems: 'flex-start',

        marginBottom: 16,    marginBottom: 16,

    },  },

    vehicleIconContainer: {  vehicleIconContainer: {

        width: 48,    width: 48,

        height: 48,    height: 48,

        borderRadius: 24,    borderRadius: 24,

        backgroundColor: Colors.primaryLight,    backgroundColor: Colors.primaryLight,

        justifyContent: 'center',    justifyContent: 'center',

        alignItems: 'center',    alignItems: 'center',

        marginRight: 16,    marginRight: 16,

    },  },

    vehicleInfo: {  vehicleInfo: {

        flex: 1,    flex: 1,

    },  },

    vehicleTitleRow: {  vehicleTitleRow: {

        flexDirection: 'row',    flexDirection: 'row',

        alignItems: 'center',    alignItems: 'center',

        marginBottom: 4,    marginBottom: 4,

    },  },

    vehicleTitle: {  vehicleTitle: {

        fontSize: 18,    fontSize: 18,

        fontWeight: '600',    fontWeight: '600',

        color: Colors.text.primary,    color: Colors.text.primary,

        marginRight: 8,    marginRight: 8,

    },  },

    primaryBadge: {  primaryBadge: {

        backgroundColor: Colors.success,    backgroundColor: Colors.success,

        borderRadius: 4,    borderRadius: 4,

        paddingHorizontal: 6,    paddingHorizontal: 6,

        paddingVertical: 2,    paddingVertical: 2,

    },  },

    primaryBadgeText: {  primaryBadgeText: {

        fontSize: 10,    fontSize: 10,

        fontWeight: '700',    fontWeight: '700',

        color: Colors.text.inverse,    color: Colors.text.inverse,

    },  },

    vehicleSubtitle: {  vehicleSubtitle: {

        fontSize: 14,    fontSize: 14,

        color: Colors.text.secondary,    color: Colors.text.secondary,

    },  },

    menuButton: {  menuButton: {

        padding: 8,    padding: 8,

        marginTop: -8,    marginTop: -8,

        marginRight: -8,    marginRight: -8,

    },  },

    vehicleActions: {  vehicleActions: {

        flexDirection: 'row',    flexDirection: 'row',

        gap: 16,    gap: 16,

    },  },

    actionButton: {  actionButton: {

        flexDirection: 'row',    flexDirection: 'row',

        alignItems: 'center',    alignItems: 'center',

        paddingVertical: 8,    paddingVertical: 8,

        paddingHorizontal: 12,    paddingHorizontal: 12,

        backgroundColor: Colors.primaryLight,    backgroundColor: Colors.primaryLight,

        borderRadius: 8,    borderRadius: 8,

        gap: 4,    gap: 4,

    },  },

    actionButtonText: {  actionButtonText: {

        fontSize: 14,    fontSize: 14,

        fontWeight: '500',    fontWeight: '500',

        color: Colors.primary,    color: Colors.primary,

    },  },

    addAnotherButton: {  addAnotherButton: {

        flexDirection: 'row',    flexDirection: 'row',

        alignItems: 'center',    alignItems: 'center',

        justifyContent: 'center',    justifyContent: 'center',

        padding: 16,    padding: 16,

        backgroundColor: Colors.surface,    backgroundColor: Colors.surface,

        borderRadius: 12,    borderRadius: 12,

        borderWidth: 2,    borderWidth: 2,

        borderColor: Colors.border,    borderColor: Colors.border,

        borderStyle: 'dashed',    borderStyle: 'dashed',

        marginBottom: 32,    marginBottom: 32,

        gap: 8,    gap: 8,

    },  },

    addAnotherButtonText: {  addAnotherButtonText: {

        fontSize: 16,    fontSize: 16,

        fontWeight: '500',    fontWeight: '500',

        color: Colors.primary,    color: Colors.primary,

    },  },

});});
